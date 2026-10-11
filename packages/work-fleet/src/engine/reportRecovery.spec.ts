import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { NodeServices } from "@effect/platform-node";
import { describe, expect } from "@effect/vitest";
import { Effect } from "effect";
import { it } from "@shivaedev/effect-test/it.ts";
import { Fleet } from "#fleet.ts";
import { prepareWork, withEngine } from "#test/engine.ts";
import { answerReport, lostReportReceipt, reportBoard } from "#test/report.ts";
import { storageDatabaseUrl } from "#test/storage.ts";

function reportFiles(root: string) {
	return readdirSync(join(root, "responses")).filter((file) => file.startsWith("fleet-report."));
}

const reconcileReport = Fleet.pipe(Effect.flatMap((fleet) => fleet.reconcile("one")));

describe("report publication recovery", () => {
	const test = it.effect.skipIf(storageDatabaseUrl === undefined);
	test("safe release allows renewal without adopting a PR or losing the archived report output", () =>
		Effect.gen(function* () {
			const root = yield* reportBoard;
			const publication = lostReportReceipt(root);
			return yield* withEngine(
				{ resultUnavailable: true },
				(fixture) =>
					Effect.gen(function* () {
						yield* prepareWork("one");
						const fleet = yield* Fleet;
						yield* fleet.dispatch("one");
						for (const [id, observation] of fixture.observations) {
							fixture.observations.set(id, { ...observation, execution: "completed", output: "Archived findings." });
						}
						const failed = yield* fleet.reconcile("one");
						const decision = failed.value.decision?.published;
						if (decision === undefined) {
							return yield* Effect.die(new Error("Report publication failure needs a Board decision"));
						}
						answerReport(root, decision, "release");
						expect((yield* fleet.reconcile("one")).value.stage).toBe("released");
						const renewed = yield* prepareWork("one");
						expect(renewed.value.stage).toBe("prepared");
						expect(renewed.value.history?.[0]?.attempts[0]?.output).toBe("Archived findings.");
						expect(fixture.launched).toHaveLength(1);
						expect(publication.count()).toBe(1);
					}),
				publication.board,
			);
		}).pipe(Effect.provide(NodeServices.layer)));
	test("retries a lost publication receipt after restart without another result or worker", () =>
		Effect.gen(function* () {
			const root = yield* reportBoard;
			const publication = lostReportReceipt(root);
			return yield* withEngine(
				{ resultUnavailable: true },
				(fixture) =>
					Effect.gen(function* () {
						yield* prepareWork("one");
						const fleet = yield* Fleet;
						yield* fleet.dispatch("one");
						for (const [id, observation] of fixture.observations) {
							fixture.observations.set(id, { ...observation, execution: "completed", output: "# Complete findings\n\nEvidence.\n" });
						}
						const failed = yield* fleet.reconcile("one");
						expect(failed.value.stage).toBe("needs-human");
						const renewal = yield* prepareWork("one").pipe(Effect.flip);
						expect(renewal.message).toContain("Reconcile the completed report before renewing");
						const [resultFile] = reportFiles(root);
						expect(resultFile).toBeDefined();
						const bytes = readFileSync(join(root, "responses", resultFile ?? "missing"), "utf8");
						const decision = failed.value.decision?.published;
						if (decision === undefined) {
							return yield* Effect.die(new Error("Report publication failure needs a Board decision"));
						}
						answerReport(root, decision, "retry");
						const completed = yield* fixture.restart(reconcileReport);
						expect({ blocker: completed.value.blocker, decision: completed.value.decision?.reason, stage: completed.value.stage }).toEqual({
							blocker: undefined,
							decision: undefined,
							stage: "completed",
						});
						expect(publication.count()).toBe(2);
						yield* fleet.reconcile("one");
						expect(publication.count()).toBe(2);
						expect(fixture.launched).toHaveLength(1);
						expect(fixture.reviews).toEqual([]);
						expect(fixture.merged).toEqual([]);
						expect(reportFiles(root)).toEqual([resultFile]);
						expect(readFileSync(join(root, "responses", resultFile ?? "missing"), "utf8")).toBe(bytes);
					}),
				publication.board,
			);
		}).pipe(Effect.provide(NodeServices.layer)));
});
