import { expect } from "@effect/vitest";
import { isolatedEngine } from "#test/engineStory.ts";
import { nativeStalledTurn } from "#test/nativeStalledTurn.ts";

for (const change of ["count", "status"] as const) {
	isolatedEngine.it(
		`changing item ${change} resets the timer without steering`,
		[nativeStalledTurn()],
		function* ({ nativeRequests, addProviderItem, changeProviderItemStatus, advanceTime, currentTime, fleet, prepareWork }) {
			yield* prepareWork("one");
			yield* fleet.dispatch("one");
			yield* fleet.reconcile("one");
			for (let index = 0; index < 5; index += 1) {
				advanceTime(20 * 60_000);
				if (change === "count") {
					addProviderItem();
				} else {
					changeProviderItemStatus();
				}
				const current = yield* fleet.reconcile("one");
				expect(current.value.attempts[0]?.progress?.at).toBe(currentTime());
			}
			expect(nativeRequests().filter((request) => ["turn/steer", "turn/interrupt"].includes(request.method))).toEqual([]);
		},
	);
}

isolatedEngine.it(
	"a changed brief pauses a stalled worker before Fleet sends a steer",
	[nativeStalledTurn()],
	function* ({ nativeRequests, advanceTime, fleet, prepareWork, editWork }) {
		yield* prepareWork("one");
		yield* fleet.dispatch("one");
		yield* fleet.reconcile("one");
		advanceTime(31 * 60_000);
		editWork("one", "edited-brief");
		const paused = yield* fleet.reconcile("one");
		expect(paused.value).toMatchObject({ decision: { code: "fleet-stale" }, step: "waiting" });
		expect(nativeRequests().filter((request) => ["turn/steer", "turn/interrupt"].includes(request.method))).toEqual([]);
	},
);
