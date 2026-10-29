import { expect } from "@effect/vitest";
import { Effect } from "effect";
import { executing } from "#model.ts";
import { isolatedEngine } from "#test/engineStory.ts";
import { ANSWER_INSTRUCTIONS, unobservableAnswer } from "#test/unobservableAnswer.ts";

for (const legacy of [false, true]) {
	isolatedEngine.it(
		`an invisible ${legacy ? "legacy" : "new"} accepted answer restarts once with its instructions, then releases areas and asks the orchestrator across restart`,
		[unobservableAnswer(legacy)],
		function* ({ fleet, advanceTime, restart, hideNativeTurn, nativeRequests, prepareWork, publishedDecisions, setAreas, attemptDispatch }) {
			const answered = (yield* fleet.get("one")).value;
			expect(answered.attempts.at(-1)?.receipt?.turnId).toBe("turn-2");
			setAreas("two", ["server"]);
			yield* prepareWork("two");
			expect((yield* attemptDispatch("two")).message).toContain("area server held by one");
			yield* fleet.reconcile("one");
			advanceTime(299_999);
			expect((yield* fleet.reconcile("one")).value.attempts.map((attempt) => attempt.operationId)).toEqual(["operation-1", "operation-2"]);
			advanceTime(1);
			yield* restart();
			const recovered = (yield* fleet.reconcile("one")).value;
			expect(recovered.step).toBe("working");
			expect(recovered.attempts.at(-1)).toMatchObject({ observationRetries: 1, prompt: expect.stringContaining(ANSWER_INSTRUCTIONS) });
			expect(recovered.attempts.at(-1)?.prompt).toContain(answered.prompt);
			expect(recovered.attempts.at(-1)?.prompt).toContain("Continue on the same branch and PR");
			expect(recovered.attempts.at(-1)?.sessionId).not.toBe(answered.attempts.at(-1)?.sessionId);
			expect(recovered.attempts[1]?.abandoned).toBeDefined();
			expect((yield* attemptDispatch("two")).message).toContain("area server held by one");
			hideNativeTurn("turn-3");
			yield* fleet.reconcile("one");
			advanceTime(300_000);
			yield* restart();
			const exhausted = (yield* fleet.reconcile("one")).value;
			expect(exhausted).toMatchObject({
				attentionOwner: "orchestrator",
				decision: { code: "session-turn-missing", reason: expect.stringContaining("one automatic restart") },
				step: "waiting",
			});
			expect(executing(exhausted)).toBe(false);
			expect(publishedDecisions()).toContain(exhausted.decision?.reason);
			yield* fleet.reconcile("one");
			expect(
				nativeRequests()
					.filter((request) => request.method === "turn/start")
					.map((request) => request.params),
			).toMatchObject([
				{ clientUserMessageId: "operation-1" },
				{ clientUserMessageId: "operation-2" },
				{ clientUserMessageId: recovered.attempts.at(-1)?.operationId, input: [{ text: expect.stringContaining(ANSWER_INSTRUCTIONS) }] },
			]);
			expect((yield* fleet.dispatch("two")).value.step).toBe("working");
		},
	);
}

for (const progress of ["item", "event"] as const) {
	isolatedEngine.it(
		`${progress} progress on the active thread keeps an invisible answer executing beyond the visibility grace period`,
		[unobservableAnswer()],
		function* ({ fleet, advanceTime, addProviderItem, emitProviderEvent, restart, nativeRequests, publishedDecisions }) {
			yield* fleet.reconcile("one");
			for (let pass = 0; pass < 3; pass += 1) {
				yield* restart();
				yield* fleet.reconcile("one");
				advanceTime(360_000);
				if (progress === "item") {
					addProviderItem();
				} else {
					emitProviderEvent();
				}
				const current = (yield* fleet.reconcile("one")).value;
				expect(current.step).toBe("working");
				expect(current.decision).toBeUndefined();
				expect(current.attempts.at(-1)?.receipt?.turnId).toBe("turn-2");
			}
			expect(
				nativeRequests()
					.filter((request) => request.method === "turn/start")
					.map((request) => request.params),
			).toMatchObject([{ clientUserMessageId: "operation-1" }, { clientUserMessageId: "operation-2", input: [{ text: ANSWER_INSTRUCTIONS }] }]);
			expect(publishedDecisions()).toEqual(["May I use the existing dependency?"]);
		},
	);
}

isolatedEngine.it(
	"a second answer to a missing active turn reports failure instead of silently accepting the instructions",
	[unobservableAnswer("parked")],
	function* ({ fleet, respond, nativeRequests }) {
		const current = (yield* fleet.get("one")).value;
		const decision = current.decision;
		if (decision === undefined) {
			return yield* Effect.die("Expected a missing-turn decision");
		}
		const answer = respond(decision.id, "retry", "answer", "Keep the existing dependency.");
		const failure = yield* fleet.resolve("one", decision.id, answer).pipe(Effect.flip);
		expect(failure.message).toContain("Cannot apply answer:");
		expect(failure.message).toContain("no answer turn was submitted");
		expect(
			nativeRequests()
				.filter((request) => request.method === "turn/start")
				.map((request) => request.params),
		).toMatchObject([{ clientUserMessageId: "operation-1" }, { clientUserMessageId: "operation-2", input: [{ text: ANSWER_INSTRUCTIONS }] }]);
	},
);
