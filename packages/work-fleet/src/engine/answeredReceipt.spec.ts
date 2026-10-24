import { expect } from "@effect/vitest";
import { Effect } from "effect";
import { isolatedEngine } from "#test/engineStory.ts";
import { answerReceiptDuringBoardRead } from "#test/engineTimingTraits.ts";
import { markdownWork } from "#test/engineTraits.ts";
import { QUESTION } from "#test/workerQuestion.ts";

isolatedEngine.it(
	"observes the persisted answer receipt when it lands during the advance pass Board read",
	[markdownWork(), answerReceiptDuringBoardRead()],
	function* ({
		answerWorker,
		launches,
		providerCalls,
		workerQuestion,
		answerRecoveries,
		pendingAnswerAttempt,
		receiveAnswerDuringBoardRead,
		prepareWork,
		restart,
		fleet,
	}) {
		yield* prepareWork("one");
		yield* fleet.dispatch("one");
		yield* workerQuestion("one", QUESTION);
		const stopped = yield* fleet.reconcile("one");
		const decision = stopped.value.decision;
		if (decision?.published === undefined) {
			return yield* Effect.die("Missing published worker question");
		}
		const answer = yield* answerWorker(decision);
		receiveAnswerDuringBoardRead();
		const continued = (yield* fleet.reconcile("one").pipe(Effect.timeout("5 seconds"))).value;
		expect(pendingAnswerAttempt()).toMatchObject({ status: "submitting" });
		expect(pendingAnswerAttempt()?.receipt).toBeUndefined();
		expect(continued.step).toBe("working");
		expect(continued.decision).toBeUndefined();
		expect(continued.attempts.at(-1)).toMatchObject({ prompt: answer.body, receipt: { sessionId: decision.worker?.sessionId }, status: "running" });
		expect(answerRecoveries()).toBe(0);
		expect(launches()).toHaveLength(1);
		expect(providerCalls().filter((call) => call.call === "turn")).toHaveLength(2);
		yield* restart();
		yield* fleet.reconcile("one");
		expect(answerRecoveries()).toBe(0);
	},
	{ clock: "live" },
);
