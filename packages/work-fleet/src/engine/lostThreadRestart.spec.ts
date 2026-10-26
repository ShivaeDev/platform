import { expect } from "@effect/vitest";
import { Effect } from "effect";
import { publishedWork } from "#test/engineLostTurnTraits.ts";
import { isolatedEngine } from "#test/engineStory.ts";
import { lostThreadAcknowledgement } from "#test/lostThreadAcknowledgement.ts";
import { lostThreadRestartStory } from "#test/recoveryStories.ts";

isolatedEngine.it(
	"a lost thread without published work restarts automatically and fences late acknowledgements",
	[lostThreadAcknowledgement()],
	function* ({
		prepareWork,
		dispatch,
		get,
		restart,
		advanceTime,
		schedule,
		launches,
		publishedDecisions,
		acknowledgeProviderTurn,
		setAreas,
		attemptDispatch,
	}) {
		setAreas("one", ["fleet/runtime"]);
		setAreas("two", ["fleet/runtime"]);
		yield* prepareWork("one");
		yield* prepareWork("two");
		yield* dispatch("one");
		for (const delay of [30_000, 60_000, 120_000, 240_000]) {
			advanceTime(delay);
			yield* restart();
			yield* schedule();
		}
		const queued = (yield* get("one")).value;
		expect(queued.decision).toBeUndefined();
		expect(queued.launchRetry).toMatchObject({ rejections: 1 });
		expect(queued.attempts[0]).toMatchObject({ sessionUnusable: true, status: "failed" });
		expect(queued.attempts[0]?.abandoned?.observationError).toContain("no remote branch");
		expect((yield* attemptDispatch("two")).message).toContain("area fleet/runtime held by one");
		expect((yield* get("two")).value.attempts).toEqual([]);
		expect((yield* acknowledgeProviderTurn("operation-1", { sessionId: "late", turnId: "late" }).pipe(Effect.result))._tag).toBe("Failure");
		advanceTime(30_000);
		yield* restart();
		yield* schedule();
		const resumed = (yield* get("one")).value;
		const freshOperation = resumed.attempts.at(-1)?.operationId;
		expect(resumed.step).toBe("working");
		expect(freshOperation).not.toBe(queued.attempts[0]?.operationId);
		expect(resumed.attempts.at(-1)?.receipt).toEqual({ sessionId: `session-${freshOperation}`, turnId: `turn-${freshOperation}` });
		expect(resumed.responses).toBeUndefined();
		expect(publishedDecisions()).toEqual([]);
		expect(launches()).toEqual(["operation-1", freshOperation]);
	},
);

for (const publication of ["branch", "pr"] as const) {
	isolatedEngine.it(
		`a lost thread with a published ${publication} keeps ownership and asks the orchestrator`,
		[lostThreadAcknowledgement(), publishedWork(publication)],
		function* ({ prepareWork, dispatch, get, restart, advanceTime, schedule, launches }) {
			yield* prepareWork("one");
			yield* dispatch("one");
			for (const delay of [30_000, 60_000, 120_000, 240_000]) {
				advanceTime(delay);
				yield* restart();
				yield* schedule();
			}
			const waiting = (yield* get("one")).value;
			expect(waiting.step).toBe("waiting");
			expect(waiting.decision?.attentionOwner).toBe("orchestrator");
			expect(waiting.decision?.reason).toContain("published work");
			expect(waiting.attempts[0]?.status).toBe("submitting");
			expect(waiting.launchRetry).toBeUndefined();
			expect(launches()).toEqual(["operation-1"]);
		},
	);
}

isolatedEngine.it(
	lostThreadRestartStory.name,
	[lostThreadAcknowledgement(5)],
	function* ({ prepareWork, dispatch, get, restart, advanceTime, schedule, launches, answerDecision }) {
		yield* prepareWork("one");
		yield* dispatch("one");
		for (let loss = 1; loss <= 5; loss += 1) {
			for (const delay of [30_000, 60_000, 120_000, 240_000]) {
				advanceTime(delay);
				yield* restart();
				yield* schedule();
			}
			advanceTime(300_000);
			yield* restart();
			yield* schedule();
		}
		const waiting = (yield* get("one")).value;
		expect(waiting.step).toBe("waiting");
		expect(waiting.decision?.reason).toContain("automatic fresh-thread restart limit reached");
		expect(waiting.attempts.at(-1)?.status).toBe("submitting");
		expect(waiting.launchRetry).toBeUndefined();
		expect(launches()).toEqual(["operation-1", "operation-2", "operation-3", "operation-4", "operation-5"]);
		yield* answerDecision("one", "retry");
		yield* restart();
		const resumed = (yield* dispatch("one")).value;
		expect(resumed.step).toBe("working");
		expect(resumed.attempts.at(-1)?.receipt?.sessionId).toBe("session-operation-6");
		expect(resumed.responses).toMatchObject([{ action: "retry", boardAcknowledged: true }]);
	},
);
