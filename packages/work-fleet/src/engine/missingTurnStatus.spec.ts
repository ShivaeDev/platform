import { expect } from "@effect/vitest";
import { recoveryFleet } from "#test/recoveryFleet.ts";
import { lostAcknowledgement } from "#test/recoveryTraits.ts";

for (const follow of [false, true]) {
	recoveryFleet.it(
		`status and watch${follow ? " --follow" : ""} describe the lost turn's relaunch after restart`,
		[lostAcknowledgement()],
		function* ({ fleet, provider, status, watch }) {
			yield* fleet.prepare();
			provider.lose((yield* fleet.dispatch()).value.attempts.at(-1)?.sessionId);
			yield* fleet.reconcile();
			yield* fleet.restart();
			const visible = yield* status();
			expect(visible).toContain("Active (1)");
			expect(visible).toContain("one  executing");
			expect(visible).toContain("Lost turn relaunched.");
			expect(visible).toContain("no remote branch");
			const output = yield* watch(follow);
			expect(output.stdout).toContain("one executing: Lost turn relaunched.");
			expect(output.code).toBe(4);
			expect((yield* fleet.get()).value.releaseReason).toBeUndefined();
		},
	);
}
