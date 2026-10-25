import { expect } from "@effect/vitest";
import { isolatedEngine } from "#test/engineStory.ts";
import { nativeStalledTurn } from "#test/nativeStalledTurn.ts";

isolatedEngine.it(
	"a stalled reviewer continues its own thread with read-only access",
	[nativeStalledTurn()],
	function* ({ nativeRequests, setNativeTurnState, advanceTime, fleet, prepareWork }) {
		yield* prepareWork("one");
		yield* fleet.dispatch("one");
		setNativeTurnState("turn-1", "completed");
		expect((yield* fleet.reconcile("one")).value.step).toBe("reviewing");
		advanceTime(31 * 60_000);
		yield* fleet.reconcile("one");
		advanceTime(30 * 60_000);
		const retried = yield* fleet.reconcile("one");
		expect(retried.value.attempts.at(-1)).toMatchObject({
			receipt: { sessionId: "reviewer-thread", turnId: "turn-3" },
			reviewHead: "head-one-0",
			role: "reviewer",
			stallRecovery: { count: 2 },
		});
		expect(
			nativeRequests()
				.filter((request) => request.method === "turn/steer")
				.at(-1)?.params,
		).toMatchObject({
			expectedTurnId: "turn-2",
			threadId: "reviewer-thread",
		});
		expect(
			nativeRequests()
				.filter((request) => request.method === "turn/start")
				.at(-1)?.params,
		).toMatchObject({
			approvalPolicy: "never",
			sandboxPolicy: { networkAccess: true, type: "readOnly" },
			threadId: "reviewer-thread",
		});
		expect(nativeRequests().filter((request) => request.method === "thread/start")).toHaveLength(2);
	},
);
