import { expect } from "@effect/vitest";
import { isolatedEngine } from "#test/engineStory.ts";
import { nativeStalledTurn } from "#test/nativeStalledTurn.ts";

isolatedEngine.it(
	"a silent reviewer asks the orchestrator without messaging its thread",
	[nativeStalledTurn()],
	function* ({ nativeRequests, setNativeTurnState, advanceTime, fleet, prepareWork }) {
		yield* prepareWork("one");
		yield* fleet.dispatch("one");
		setNativeTurnState("turn-1", "completed");
		expect((yield* fleet.reconcile("one")).value.step).toBe("reviewing");
		advanceTime(31 * 60_000);
		const stalled = yield* fleet.reconcile("one");
		expect(stalled.value).toMatchObject({ decision: { code: "session-stalled" }, step: "waiting" });
		expect(stalled.value.attempts.at(-1)).toMatchObject({
			receipt: { sessionId: "reviewer-thread", turnId: "turn-2" },
			role: "reviewer",
			sessionUnusable: true,
			status: "running",
		});
		expect(nativeRequests().filter((request) => ["turn/steer", "turn/interrupt"].includes(request.method))).toEqual([]);
	},
);
