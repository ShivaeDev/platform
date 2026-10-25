import { expect } from "@effect/vitest";
import { Effect } from "effect";
import { SessionFailure } from "#session/schema.ts";
import { exhaustedQuestionThread, failedAnswerSubmission } from "#test/answeredFallbackTraits.ts";
import { engineConfiguration } from "#test/engineConfiguration.ts";
import { engine, isolatedEngine } from "#test/engineStory.ts";
import { markdownWork } from "#test/engineTraits.ts";
import { QUESTION } from "#test/workerQuestion.ts";

{
	let now = 100;
	let unusableSession: string | undefined;
	const rejection = new SessionFailure({ code: "session-active-turn-exhausted", message: "Thread cannot accept another turn", reason: "rejected" });
	const exhaustedQuestionThreadTrait = engineConfiguration(
		"exhausted question thread",
		exhaustedQuestionThread({ now: () => now, rejection: () => rejection, unusableSession: () => unusableSession }),
	);
	isolatedEngine.it(
		"a definitively wedged question thread continues with its answer and existing PR after restart",
		[markdownWork(), exhaustedQuestionThreadTrait],
		function* ({ replaceStoredRecord, answerWorker, launches, providerStarts, workerQuestion, prepareWork, restart, fleet }) {
			yield* prepareWork("one");
			yield* fleet.dispatch("one");
			yield* workerQuestion("one", QUESTION);
			const stopped = yield* fleet.reconcile("one");
			const decision = stopped.value.decision;
			if (decision?.published === undefined) {
				return yield* Effect.die("Missing published worker question");
			}
			const result = { head: "existing-head", kind: "change" as const, paths: ["src/one.ts"], pr: "https://github.com/example/repository/pull/1" };
			yield* replaceStoredRecord({ ...stopped.value, result });
			const answer = yield* answerWorker(decision);
			unusableSession = decision.worker?.sessionId;
			const queued = (yield* fleet.resolve("one", decision.id, answer.id)).value;
			expect(queued.step).toBe("repairing");
			expect(queued.decision).toBeUndefined();
			expect(queued.attempts.at(-1)).toMatchObject({ sessionUnusable: true, status: "failed" });
			expect(queued.responses).toMatchObject([{ boardAcknowledged: true, responseId: answer.id }]);
			now = 30_100;
			const resumed = (yield* Effect.gen(function* () {
				yield* restart();
				return yield* fleet.reconcile("one");
			})).value;
			expect(resumed.step).toBe("working");
			expect(resumed.result).toEqual(result);
			expect(resumed.preparation).toEqual(stopped.value.preparation);
			expect(resumed.attempts.at(-1)?.receipt?.sessionId).not.toBe(unusableSession);
			expect(providerStarts().at(-1)?.prompt).toContain(stopped.value.prompt);
			expect(providerStarts().at(-1)?.prompt).toContain(QUESTION);
			expect(providerStarts().at(-1)?.prompt).toContain(answer.body);
			expect(providerStarts().at(-1)?.prompt).toContain(result.pr);
			expect(providerStarts().at(-1)?.prompt).toContain("same branch");
			expect(launches()).toEqual(["operation-1", "operation-3"]);
			yield* fleet.resolve("one", decision.id, answer.id);
			expect((yield* fleet.get("one")).value.attempts).toEqual(resumed.attempts);
		},
	);
}

for (const reason of ["rejected", "ambiguous", "unavailable"] as const) {
	{
		let fail = false;
		const failure = new SessionFailure({ code: "session-rejected", message: "Continuation failed", reason });
		const failedAnswerSubmissionTrait = engineConfiguration(
			"failed answer submission",
			failedAnswerSubmission({ fail: () => fail, failure: () => failure }),
		);
		engine.it(
			`a ${reason} submission without definite exhaustion retains the answer without starting another thread`,
			[markdownWork(), failedAnswerSubmissionTrait],
			function* ({ answerWorker, launches, workerQuestion, prepareWork, restart, fleet }) {
				yield* prepareWork("one");
				yield* fleet.dispatch("one");
				yield* workerQuestion("one", QUESTION);
				const stopped = yield* fleet.reconcile("one");
				const decision = stopped.value.decision;
				if (decision?.published === undefined) {
					return yield* Effect.die("Missing published worker question");
				}
				const answer = yield* answerWorker(decision);
				fail = true;
				yield* fleet.resolve("one", decision.id, answer.id);
				const blocked = (yield* Effect.gen(function* () {
					yield* restart();
					return yield* fleet.reconcile("one");
				})).value;
				expect(blocked.step).toBe("waiting");
				expect(blocked.attempts.map(({ operationId }) => operationId)).toEqual(["operation-1", "operation-2"]);
				expect(blocked.attempts.at(-1)?.sessionUnusable).toBeUndefined();
				expect(blocked.responses).toMatchObject([{ responseId: answer.id }]);
				expect(launches()).toEqual(["operation-1"]);
			},
		);
	}
}
