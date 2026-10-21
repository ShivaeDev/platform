import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { NodeServices } from "@effect/platform-node";
import { describe, expect } from "@effect/vitest";
import { Effect, Layer } from "effect";
import { Fleet } from "#fleet.ts";
import { reportBoard as attachmentReportBoard } from "#host/reportBoard.ts";
import { BoardFailure } from "#policy.ts";
import { prepareWork, withEngine } from "#test/engine.ts";
import { postgresTests } from "#test/postgres.ts";
import { answerReport, lostReportReceipt, reportBoard } from "#test/report.ts";

function reportFiles(root: string) {
	return readdirSync(join(root, "responses")).filter((file) => file.startsWith("fleet-report.") && file.endsWith(".md"));
}

const reconcileReport = Fleet.pipe(Effect.flatMap((fleet) => fleet.reconcile("one")));

describe("report publication recovery", () => {
	const test = postgresTests("test");
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
						expect((yield* fleet.reconcile("one")).value.step).toBe("released");
						const renewed = yield* prepareWork("one");
						expect(renewed.value.step).toBe("queued");
						expect(renewed.value.history?.[0]?.attempts[0]?.output).toBe("Archived findings.");
						expect(fixture.launched).toHaveLength(1);
						expect(publication.count()).toBe(1);
					}),
				publication.board,
			);
		}).pipe(Effect.provide(NodeServices.layer)));
	test("retries a lost publication receipt after restart with unavailable retrieval and no changed bytes, result or worker", () =>
		Effect.gen(function* () {
			const root = yield* reportBoard;
			const publication = lostReportReceipt(root);
			let available = true;
			let collections = 0;
			const collector = attachmentReportBoard(
				root,
				() => Effect.succeed(false),
				() => {
					collections += 1;
					return available
						? Effect.succeed({ files: [{ bytes: new TextEncoder().encode("Original bytes."), path: "evidence.txt" }], unavailable: [] })
						: Effect.fail(new BoardFailure({ message: "Retrieval became unavailable" }));
				},
			).pipe(Layer.provide(publication.board));
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
						expect(failed.value.step).toBe("waiting");
						const renewal = yield* prepareWork("one").pipe(Effect.flip);
						expect(renewal.message).toContain("Reconcile the report before renewing");
						const [resultFile] = reportFiles(root);
						expect(resultFile).toBeDefined();
						const bytes = readFileSync(join(root, "responses", resultFile ?? "missing"), "utf8");
						const decision = failed.value.decision?.published;
						if (decision === undefined) {
							return yield* Effect.die(new Error("Report publication failure needs a Board decision"));
						}
						answerReport(root, decision, "retry");
						available = false;
						const completed = yield* fixture.restart(reconcileReport);
						expect({ blocker: completed.value.blocker, decision: completed.value.decision?.reason, step: completed.value.step }).toEqual({
							blocker: undefined,
							decision: undefined,
							step: "done",
						});
						expect(publication.count()).toBe(2);
						expect(collections).toBe(1);
						yield* fleet.reconcile("one");
						expect(publication.count()).toBe(2);
						expect(fixture.launched).toHaveLength(1);
						expect(fixture.reviews).toEqual([]);
						expect(fixture.merged).toEqual([]);
						expect(reportFiles(root)).toEqual([resultFile]);
						expect(readFileSync(join(root, "responses", resultFile ?? "missing"), "utf8")).toBe(bytes);
					}),
				collector,
			);
		}).pipe(Effect.provide(NodeServices.layer)));
});
