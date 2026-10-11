import { expect } from "@effect/vitest";
import { Deferred, Effect, Fiber } from "effect";
import { it } from "@shivaedev/effect-test/it.ts";
import { Fleet } from "#fleet.ts";
import { prepareWork, withEngine } from "#test/engine.ts";
import { HEAD, NO_CHANGE, REPORT, resultFixture } from "#test/githubResult.ts";
import { storageDatabaseUrl } from "#test/storage.ts";
import { startWorkerReport, workerReportReply } from "#test/workerReport.ts";

const test = it.effect.skipIf(storageDatabaseUrl === undefined);

test("a repair report receives its correction on the existing worker thread without archiving the cycle", () => {
	const github = resultFixture({ after: { "changed_files": 1 }, before: { "changed_files": 1 }, files: [[{ filename: "src/one.ts" }]] });
	return withEngine({ repairs: true, resultQuery: github.adopt }, (fixture) =>
		Effect.gen(function* () {
			const fleet = yield* Fleet;
			const { followUp: repair, original } = yield* startWorkerReport(fixture, REPORT);
			expect(repair.value.attempts.at(-1)?.role).toBe("repair");
			yield* workerReportReply(fixture, repair, "Missing repair report");
			const correction = yield* fleet.reconcile("one");
			expect(correction.value.stage).toBe("executing");
			expect(correction.value.attempts.at(-1)).toMatchObject({ role: "repair", sessionId: original.sessionId });
			expect(correction.value.attempts).toHaveLength(4);
			expect(correction.value.history).toBeUndefined();
			yield* workerReportReply(fixture, correction, NO_CHANGE);
			expect((yield* fleet.reconcile("one")).value.stage).toBe("completed");
			expect(fixture.reviews).toEqual([HEAD, HEAD]);
		}),
	);
});

test("persists the correction before provider acceptance and reconciles its lost acknowledgement after restart", function* () {
	const entered = yield* Deferred.make<void>();
	const release = yield* Deferred.make<void>();
	const continuationGate = Deferred.succeed(entered, undefined).pipe(Effect.andThen(Deferred.await(release)));
	yield* withEngine({ continuationGate, lostContinuationAcknowledgement: true, resultQuery: resultFixture().adopt }, (fixture) =>
		Effect.gen(function* () {
			const fleet = yield* Fleet;
			yield* prepareWork("one");
			const dispatched = yield* fleet.dispatch("one");
			const original = yield* workerReportReply(fixture, dispatched, "Missing report");
			const following = yield* fleet.reconcile("one").pipe(Effect.forkChild);
			yield* Deferred.await(entered);
			const intent = yield* fixture.restart(Effect.flatMap(Fleet, (restarted) => restarted.get("one")));
			const attempt = intent.value.attempts.at(-1);
			expect(intent.value.stage).toBe("executing");
			expect(intent.value.attempts).toHaveLength(2);
			expect(attempt).toMatchObject({ role: "worker", sessionId: original.sessionId, status: "submitting" });
			expect(attempt?.prompt).toContain("Reply only with a corrected report");
			expect(attempt?.receipt).toBeUndefined();
			expect(fixture.operations.size).toBe(1);
			yield* Deferred.succeed(release, undefined);
			const lost = yield* Fiber.join(following);
			expect(lost.value.attempts.at(-1)?.operationId).toBe(attempt?.operationId);
			expect(lost.value.attempts.at(-1)?.receipt).toBeUndefined();
			expect(fixture.operations.size).toBe(2);
			const recovered = yield* fixture.restart(Effect.flatMap(Fleet, (restarted) => restarted.reconcile("one")));
			expect(recovered.value.attempts.at(-1)).toMatchObject({ operationId: attempt?.operationId, status: "running" });
			expect(recovered.value.attempts.at(-1)?.receipt?.sessionId).toBe(original.sessionId);
			expect(fixture.settings.filter((call) => call.call === "turn")).toHaveLength(2);
			yield* workerReportReply(fixture, recovered, NO_CHANGE);
			const completed = yield* fleet.reconcile("one");
			expect(completed.value.stage).toBe("completed");
			expect(completed.value.result).toMatchObject({ head: HEAD, kind: "no-change" });
			expect(fixture.launched).toHaveLength(2);
		}),
	);
});

test("a malformed human-requested retry returns to needs-human without another automatic follow-up", () =>
	withEngine({ resultQuery: resultFixture().adopt }, (fixture) =>
		Effect.gen(function* () {
			const fleet = yield* Fleet;
			const { followUp } = yield* startWorkerReport(fixture, "Missing report");
			yield* workerReportReply(fixture, followUp, "Still missing");
			const blocked = yield* fleet.reconcile("one");
			const decisionId = blocked.value.decision?.id ?? "missing";
			fixture.respond(decisionId, "retry");
			const retry = yield* fleet.reconcile("one");
			expect(retry.value.stage).toBe("executing");
			expect(retry.value.attempts).toHaveLength(3);
			yield* workerReportReply(fixture, retry, `${REPORT}\nTrailing text`);
			const malformed = yield* fixture.restart(Effect.flatMap(Fleet, (restarted) => restarted.reconcile("one")));
			expect(malformed.value.stage).toBe("needs-human");
			expect(malformed.value.decision?.id).not.toBe(decisionId);
			expect(malformed.value.attempts).toHaveLength(3);
			expect(fixture.settings.filter((call) => call.call === "turn")).toHaveLength(3);
			expect(fixture.decisions).toHaveLength(2);
			expect(fixture.reviews).toHaveLength(0);
		}),
	));
