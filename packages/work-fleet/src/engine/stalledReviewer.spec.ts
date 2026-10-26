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

for (const activity of ["event", "completion"] as const) {
	isolatedEngine.it(
		`a stalled reviewer resumes on ${activity} and finishes reviewing the same head`,
		[nativeStalledTurn()],
		function* ({ setNativeTurnState, advanceTime, fleet, prepareWork, emitProviderEvent, completeNativeTurn, acknowledgements, nativeRequests }) {
			yield* prepareWork("one");
			yield* fleet.dispatch("one");
			setNativeTurnState("turn-1", "completed");
			yield* fleet.reconcile("one");
			advanceTime(30 * 60_000);
			const stalled = yield* fleet.reconcile("one");
			expect(stalled.value.decision?.code).toBe("session-stalled");
			advanceTime(60_000);
			if (activity === "event") {
				emitProviderEvent("reviewer-thread");
				const resumed = yield* fleet.reconcile("one");
				expect(resumed.value.step).toBe("reviewing");
				expect(resumed.value.decision).toBeUndefined();
			}
			completeNativeTurn(
				"turn-2",
				'## TL;DR\n\nApproved.\n\n## Details\n\nNo findings.\n\nFLEET_REVIEW: {"evidence":["Inspected the diff"],"findings":[],"head":"head-one-0","verdict":"approve"}',
			);
			const finished = yield* fleet.reconcile("one");
			expect(finished.value.step).toBe("done");
			expect(finished.value.review).toMatchObject({ head: stalled.value.result?.head, verdict: "approved" });
			expect(finished.value.attempts.map(({ receipt }) => receipt)).toEqual(stalled.value.attempts.map(({ receipt }) => receipt));
			expect(finished.value.decision).toBeUndefined();
			expect(acknowledgements()).toMatchObject([{ decision: stalled.value.decision?.published, disposition: "superseded" }]);
			expect(nativeRequests().filter(({ method }) => method === "turn/interrupt")).toEqual([]);
		},
	);
}
