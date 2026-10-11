import { describe, expect } from "@effect/vitest";
import { Effect } from "effect";
import { it } from "@shivaedev/effect-test/it.ts";
import { Fleet } from "#fleet.ts";
import { withEngine } from "#test/engine.ts";
import { HEAD, NO_CHANGE, PR, REPORT, resultFixture } from "#test/githubResult.ts";
import { storageDatabaseUrl } from "#test/storage.ts";
import { startWorkerReport, workerReportReply } from "#test/workerReport.ts";

describe("worker report correction through PostgreSQL", () => {
	const test = it.effect.skipIf(storageDatabaseUrl === undefined);
	for (const malformed of [
		`FLEET_PR: ${PR}`,
		`FLEET_HEAD: short\nFLEET_PR: ${PR}`,
		`${REPORT}\nText after the PR line`,
		`FLEET_HEAD: ${HEAD}\nFLEET_PR: invalid`,
	]) {
		test(`corrects a malformed report on the same worker thread: ${JSON.stringify(malformed)}`, () => {
			const github = resultFixture({ after: { "changed_files": 1 }, before: { "changed_files": 1 }, files: [[{ filename: "src/one.ts" }]] });
			return withEngine({ launch: { effort: "high", model: "host-model" }, resultQuery: github.adopt, reviewRunning: true }, (fixture) =>
				Effect.gen(function* () {
					const { followUp, original } = yield* startWorkerReport(fixture, malformed);
					const attempt = followUp.value.attempts.at(-1);
					expect(followUp.value.stage).toBe("executing");
					expect(followUp.value.decision).toBeUndefined();
					expect(followUp.value.result).toBeUndefined();
					expect(followUp.value.attempts).toHaveLength(2);
					expect(attempt).toMatchObject({ role: "worker", sessionId: original.sessionId, settings: { effort: "high", model: "host-model" } });
					expect(attempt?.receipt?.turnId).not.toBe(original.turnId);
					expect(attempt?.prompt).toContain("Reply only with a corrected report");
					expect(attempt?.prompt).toContain("full 40-character head SHA");
					expect(attempt?.prompt).toContain("FLEET_HEAD: <sha>\nFLEET_PR: <url or none>");
					expect(followUp.value.attempts[0]?.output).toBe(malformed);
					expect(github.requests).toHaveLength(0);
					yield* workerReportReply(fixture, followUp, REPORT);
					const reviewing = yield* fixture.restart(Effect.flatMap(Fleet, (fleet) => fleet.reconcile("one")));
					expect(reviewing.value.stage).toBe("reviewing");
					expect(reviewing.value.result).toMatchObject({ head: HEAD, kind: "change", pr: PR });
					expect(fixture.reviews).toEqual([HEAD]);
					expect(fixture.launched).toHaveLength(2);
				}),
			);
		});
	}
	test("a second malformed reply needs a human and retry starts a new correction turn", () =>
		withEngine({ acknowledgeFailure: true, resultQuery: resultFixture().adopt }, (fixture) =>
			Effect.gen(function* () {
				const { followUp, original } = yield* startWorkerReport(fixture, "Missing report");
				yield* workerReportReply(fixture, followUp, `FLEET_PR: ${PR}`);
				const fleet = yield* Fleet;
				const blocked = yield* fixture.restart(Effect.flatMap(Fleet, (restarted) => restarted.reconcile("one")));
				expect(blocked.value.stage).toBe("needs-human");
				expect(blocked.value.decision?.reason).toContain("FLEET_HEAD");
				expect(blocked.value.attempts).toHaveLength(2);
				expect(blocked.value.result).toBeUndefined();
				expect(blocked.value.outcome).toBeUndefined();
				expect(fixture.reviews).toHaveLength(0);
				expect((yield* fleet.reconcile("one")).value.attempts).toHaveLength(2);
				const decisionId = blocked.value.decision?.id ?? "missing";
				const responseId = fixture.respond(decisionId, "retry");
				const retry = yield* fleet.resolve("one", decisionId, responseId);
				expect(retry.value.stage).toBe("executing");
				expect(retry.value.decision).toBeUndefined();
				expect(retry.value.attempts).toHaveLength(3);
				expect(retry.value.attempts.at(-1)?.prompt).toBe(followUp.value.attempts.at(-1)?.prompt);
				expect(retry.value.attempts.at(-1)?.receipt?.sessionId).toBe(original.sessionId);
				expect(retry.value.attempts.at(-1)?.receipt?.turnId).not.toBe(followUp.value.attempts.at(-1)?.receipt?.turnId);
				const repeated = yield* fixture.restart(Effect.flatMap(Fleet, (restarted) => restarted.resolve("one", decisionId, responseId)));
				expect(repeated.value.attempts).toHaveLength(3);
				expect(repeated.value.responses?.[0]?.boardAcknowledged).toBe(true);
				expect(fixture.acknowledgements).toHaveLength(1);
				expect(fixture.decisions).toHaveLength(1);
				yield* workerReportReply(fixture, repeated, NO_CHANGE);
				const completed = yield* fleet.reconcile("one");
				expect(completed.value.stage).toBe("completed");
				expect(completed.value.result).toMatchObject({ head: HEAD, kind: "no-change" });
				expect(completed.value.review?.head).toBe(HEAD);
				expect(completed.value.checks).toMatchObject({ head: HEAD, passed: true });
				expect(fixture.settings.filter((call) => call.call === "turn")).toHaveLength(4);
			}),
		));
});
