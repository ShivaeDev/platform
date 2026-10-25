import { expect } from "@effect/vitest";
import { Effect } from "effect";
import { SessionFailure } from "#session/schema.ts";
import { answeredRepairThread } from "#test/answeredRepairThread.ts";
import { engineConfiguration } from "#test/engineConfiguration.ts";
import { isolatedEngine } from "#test/engineStory.ts";
import { markdownWork } from "#test/engineTraits.ts";
import { QUESTION } from "#test/workerQuestion.ts";

for (const repair of ["review", "checks"] as const) {
	{
		let now = 100;
		let unusableSession: string | undefined;
		let head = "initial-head";
		const rejection = new SessionFailure({ code: "session-active-turn-exhausted", message: "Thread cannot accept another turn", reason: "rejected" });
		const answeredRepairThreadTrait = engineConfiguration(
			"answered repair thread",
			answeredRepairThread({
				head: () => head,
				now: () => now,
				rejection: () => rejection,
				repair: () => repair,
				unusableSession: () => unusableSession,
			}),
		);
		isolatedEngine.it(
			`an answered ${repair} repair question retains the repair instructions on a fresh thread after restart`,
			[markdownWork(), answeredRepairThreadTrait],
			function* ({ answerWorker, launches, providerStarts, reviewedHeads, workerQuestion, finishWorkers, prepareWork, restart, fleet }) {
				const prepared = (yield* prepareWork("one")).value;
				yield* fleet.dispatch("one");
				finishWorkers();
				const repairing = (yield* fleet.reconcile("one")).value;
				expect(repairing.attempts.at(-1)?.role).toBe("repair");
				const instructions = repairing.checks?.repairPrompt ?? repairing.review?.repairPrompt;
				expect(instructions).toEqual(expect.any(String));
				yield* workerQuestion("one", QUESTION);
				const stopped = yield* fleet.reconcile("one");
				const decision = stopped.value.decision;
				if (decision?.published === undefined) {
					return yield* Effect.die("Missing published worker question");
				}
				const answer = yield* answerWorker(decision);
				unusableSession = decision.worker?.sessionId;
				const queued = (yield* fleet.resolve("one", decision.id, answer.id)).value;
				expect(queued.step).toBe("repairing");
				expect(queued.decision).toBeUndefined();
				expect(queued.responses).toMatchObject([{ boardAcknowledged: true, responseId: answer.id }]);
				now = 30_100;
				yield* restart();
				const resumed = fleet;
				const continuing = (yield* resumed.reconcile("one")).value;
				const attempt = continuing.attempts.at(-1);
				expect(continuing.step).toBe("working");
				expect(continuing.result).toEqual(repairing.result);
				expect(continuing.preparation).toEqual(repairing.preparation);
				expect(attempt?.receipt?.sessionId).not.toBe(unusableSession);
				expect(attempt?.role).toBe("repair");
				const prompt = providerStarts().at(-1)?.prompt;
				expect(prompt).toContain(prepared.prompt);
				expect(prompt).toContain(instructions);
				expect(prompt).toContain(QUESTION);
				expect(prompt).toContain(answer.body);
				expect(prompt).toContain(repairing.result?.kind === "change" ? repairing.result.pr : "missing PR");
				expect(prompt).toContain("same branch");
				expect(launches()).toEqual(["operation-1", "operation-2", "operation-5"]);
				yield* resumed.resolve("one", decision.id, answer.id);
				expect((yield* resumed.get("one")).value.attempts).toEqual(continuing.attempts);
				yield* resumed.reconcile("one");
				expect((yield* resumed.get("one")).value.attempts.at(-1)?.operationId).toBe(attempt?.operationId);
				expect(launches()).toEqual(["operation-1", "operation-2", "operation-5"]);
				head = "repaired-head";
				finishWorkers();
				const completed = (yield* resumed.reconcile("one")).value;
				expect(completed.step).toBe("done");
				expect(reviewedHeads()).toEqual(["initial-head", "repaired-head"]);
				expect(completed.review?.head).toBe("repaired-head");
				expect(completed.checks).toMatchObject({ head: "repaired-head", passed: true });
			},
		);
	}
}
