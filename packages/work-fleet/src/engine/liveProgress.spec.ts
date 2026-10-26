import { expect } from "vitest";
import { isolatedEngine } from "#test/engineStory.ts";
import { nativeStalledTurn } from "#test/nativeStalledTurn.ts";

isolatedEngine.it(
	"a long turn that keeps emitting live events is never reported stuck",
	[nativeStalledTurn()],
	function* ({ emitProviderEvent, advanceTime, fleet, prepareWork, afterRestart, publishedDecisions }) {
		yield* prepareWork("one");
		yield* fleet.dispatch("one");
		yield* fleet.reconcile("one");
		for (let pass = 1; pass <= 4; pass += 1) {
			advanceTime(20 * 60_000);
			emitProviderEvent();
			const current = yield* fleet.reconcile("one");
			expect(current.value.step).toBe("working");
			expect(current.value.decision).toBeUndefined();
			expect(current.value.attempts[0]?.progress?.at).toBe(pass * 20 * 60_000);
		}
		advanceTime(29 * 60_000);
		expect((yield* afterRestart(fleet.reconcile("one"))).value.step).toBe("working");
		expect(publishedDecisions()).toEqual([]);
	},
);
