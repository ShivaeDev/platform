import { expect } from "@effect/vitest";
import { recoveryFleet } from "#test/recoveryFleet.ts";
import { lostAcknowledgement, requestedRepair, runningReview } from "#test/recoveryTraits.ts";

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

recoveryFleet.it(
	"watch --follow prints the relaunch once while recovered work advances through review and delivery",
	[lostAcknowledgement(), runningReview, requestedRepair],
	function* ({ fleet, provider, status, storedSnapshot, watch }) {
		yield* fleet.prepare();
		provider.lose((yield* fleet.dispatch()).value.attempts.at(-1)?.sessionId);
		yield* fleet.reconcile();
		const executing = yield* storedSnapshot();
		expect(yield* status()).toContain("Lost turn relaunched.");
		provider.finish();
		expect((yield* fleet.reconcile()).value.stage).toBe("reviewing");
		const reviewing = yield* storedSnapshot();
		const reviewStatus = yield* status();
		provider.finish();
		const repair = (yield* fleet.reconcile()).value;
		expect(repair.stage).toBe("executing");
		expect(repair.attempts.at(-1)?.role).toBe("repair");
		const repairing = yield* storedSnapshot();
		const repairStatus = yield* status();
		provider.finish();
		expect((yield* fleet.reconcile()).value.stage).toBe("reviewing");
		provider.finish();
		expect((yield* fleet.reconcile()).value.stage).toBe("completed");
		const completed = yield* storedSnapshot();
		const output = yield* watch(true, [executing, reviewing, repairing, completed]);
		expect(output.stdout.match(/Lost turn relaunched\./gu)).toHaveLength(1);
		expect(output.stdout).toContain("one completed");
		expect(output.code).toBe(4);
		expect(reviewStatus).not.toContain("Lost turn relaunched.");
		expect(repairStatus).not.toContain("Lost turn relaunched.");
	},
);
