import { Effect } from "effect";
import { expect } from "vitest";
import { fleetStory, limitedBy } from "#test/fleetStory.ts";
import { PR } from "#test/githubResult.ts";

for (const kind of ["execution", "backlog"] as const) {
	for (const status of ["CLOSED", "MERGED"] as const) {
		fleetStory.it(`a PR observed ${status.toLowerCase()} frees foreign ${kind} capacity for waiting work`, [limitedBy(kind)], function* (fleet) {
			yield* fleet.prepare("one");
			yield* fleet.dispatch("one");
			yield* fleet.finishWorker("one");
			expect((yield* fleet.reconcile("one")).value.stage).toBe("needs-human");
			yield* fleet.reservePr();
			yield* fleet.prepare("two");
			expect(yield* fleet.dispatch("two").pipe(Effect.flip)).toMatchObject({ kind });
			expect((yield* fleet.get("two")).value.stage).toBe("prepared");
			yield* fleet.reconcile("one");
			expect(yield* fleet.reservations()).toEqual([{ backlog: true, executing: true, owner: PR }]);
			const launches = fleet.launched.length;
			fleet.observePr(status);
			const observed = yield* fleet.reconcile("one");
			if (status === "CLOSED") {
				expect(observed.value).toMatchObject({ decision: { code: "pr-closed" }, stage: "needs-human" });
				expect(observed.value.outcome).toBeUndefined();
			}
			expect(yield* fleet.reservations()).toEqual([]);
			yield* fleet.step();
			expect((yield* fleet.get("two")).value.stage).toBe("executing");
			expect(fleet.launched).toHaveLength(launches + 1);
		});
	}
}
