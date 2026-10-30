import { expect } from "@effect/vitest";
import { isolatedEngine } from "#test/engineStory.ts";
import { unobservableAnswer } from "#test/unobservableAnswer.ts";

isolatedEngine.it(
	"an accepted answer follows its new turn while the original question turn remains terminal",
	[unobservableAnswer()],
	function* ({ fleet, showNativeTurn }) {
		showNativeTurn("turn-2");
		const current = (yield* fleet.reconcile("one")).value;
		expect(current.step).toBe("working");
		expect(current.decision).toBeUndefined();
		expect(current.attempts.at(-1)).toMatchObject({
			receipt: { sessionId: "worker-thread", turnId: "turn-2" },
			status: "running",
		});
	},
);

isolatedEngine.it(
	"an answer completion reads the new turn's result instead of the cached original question",
	[unobservableAnswer()],
	function* ({ fleet, showNativeTurn, completeNativeTurn }) {
		const nextQuestion = "Which migration should contain the approved dependency change?";
		showNativeTurn("turn-2");
		completeNativeTurn("turn-2", `FLEET_QUESTION: ${nextQuestion}`);
		const current = (yield* fleet.reconcile("one")).value;
		expect(current.decision).toMatchObject({
			code: "worker-question",
			reason: nextQuestion,
			worker: { sessionId: "worker-thread", turnId: "turn-2" },
		});
	},
);

for (const otherTurnActive of [false, true]) {
	isolatedEngine.it(
		`an absent answer is ${otherTurnActive ? "on an active thread only because another turn is running" : "on an idle thread when the other turns are terminal"}`,
		[unobservableAnswer()],
		function* ({ fleet, setNativeTurnState, advanceTime }) {
			if (!otherTurnActive) {
				setNativeTurnState("unrelated-turn", "completed");
			}
			const missing = (yield* fleet.reconcile("one")).value.attempts.at(-1);
			expect(missing).toMatchObject({
				missingSince: 0,
				output: "",
				receipt: { sessionId: "worker-thread", turnId: "turn-2" },
				status: "accepted",
			});
			if (otherTurnActive) {
				expect(missing?.progress?.signature).toContain('"id":"unrelated-turn","status":"inProgress"');
			} else {
				expect(missing?.progress?.signature).toBe("[]");
			}
			advanceTime(240_000);
			const unchanged = (yield* fleet.reconcile("one")).value;
			expect(unchanged.step).toBe("working");
			expect(unchanged.decision).toBeUndefined();
			expect(unchanged.attempts.at(-1)?.progress).toEqual(missing?.progress);
		},
	);
}
