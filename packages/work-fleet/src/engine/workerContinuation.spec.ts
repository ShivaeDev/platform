import { expect } from "@effect/vitest";
import { Effect, Fiber } from "effect";
import { Fleet } from "#fleet.ts";
import { availableQuota } from "#test/engineLaunchTraits.ts";
import { executionLimit } from "#test/engineLifecycleTraits.ts";
import { heldAction } from "#test/engineRaceTraits.ts";
import { isolatedEngine } from "#test/engineStory.ts";
import { markdownWork } from "#test/engineTraits.ts";

isolatedEngine.it(
	"interruption before provider submission retains the answer intent without replaying it after restart",
	[markdownWork(), heldAction("answer")],
	function* ({ waitForGate, fleet, prepareWork, afterRestart, providerCalls, providerOperationCount, askWorker, answerWorker }) {
		yield* prepareWork("one");
		yield* fleet.dispatch("one");
		const { decision } = yield* askWorker();
		const answer = yield* answerWorker(decision);
		const resolving = yield* fleet.resolve("one", decision.id, answer.id).pipe(Effect.forkChild);
		yield* waitForGate("entered");
		yield* Fiber.interrupt(resolving);
		const intent = (yield* fleet.get("one")).value;
		expect(intent.responses).toHaveLength(1);
		expect(intent.attempts.at(-1)?.prompt).toBe(answer.body);
		expect(intent.attempts.at(-1)?.sessionId).toBe(decision.worker?.sessionId);
		expect(intent.attempts.at(-1)?.receipt).toBeUndefined();
		yield* afterRestart(
			Effect.gen(function* () {
				const restarted = yield* Fleet;
				const uncertain = yield* restarted.reconcile("one");
				expect(uncertain.value.step).toBe("waiting");
				expect(uncertain.value.decision?.reason).toBe("No authoritative operation receipt");
				yield* restarted.resolve("one", decision.id, answer.id);
			}),
		);
		expect(providerOperationCount()).toBe(1);
		expect(providerCalls().filter((call) => call.call === "turn")).toHaveLength(2);
	},
);

isolatedEngine.it(
	"a recorded worker answer cannot continue without fresh available quota",
	[markdownWork(), availableQuota(1)],
	function* ({ fleet, prepareWork, providerCalls, askWorker, answerWorker }) {
		yield* prepareWork("one");
		yield* fleet.dispatch("one");
		const { decision } = yield* askWorker();
		yield* answerWorker(decision);
		const blocked = yield* fleet.reconcile("one");
		expect(blocked.value.step).toBe("waiting");
		expect(blocked.value.blocker).toBe("Answer failed: Fresh available provider quota is required");
		expect(blocked.value.attentionOwner).toBe("automation");
		expect(blocked.value.responses ?? []).toHaveLength(0);
		expect(providerCalls().filter((call) => call.call === "turn")).toHaveLength(1);
	},
);

isolatedEngine.it(
	"a recorded answer waits on automation while capacity is occupied and is adopted when capacity returns",
	[markdownWork(), executionLimit(1)],
	function* ({ fleet, prepareWork, finishWorkers, askWorker, answerWorker, writeBoardWork }) {
		yield* prepareWork("one");
		yield* fleet.dispatch("one");
		const { decision } = yield* askWorker();

		writeBoardWork("two.md", "---\nid: two\nkind: task\nfleet: approved\n---\n# Other work\n");
		yield* prepareWork("two");
		yield* fleet.dispatch("two");
		const answer = yield* answerWorker(decision);
		const blocked = (yield* fleet.reconcile("one")).value;
		expect(blocked.attentionOwner).toBe("automation");
		expect(blocked.blocker).toBe("Answer failed: execution capacity is occupied (limit 1)");
		expect(blocked.responses ?? []).toHaveLength(0);
		finishWorkers();
		yield* fleet.reconcile("two");
		const continued = (yield* fleet.reconcile("one")).value;
		expect(continued.step).toBe("working");
		expect(continued.responses).toMatchObject([{ responseId: answer.id }]);
		expect(continued.attempts.at(-1)?.prompt).toBe(answer.body);
	},
);
