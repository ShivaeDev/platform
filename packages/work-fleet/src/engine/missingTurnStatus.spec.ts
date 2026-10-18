import { expect } from "@effect/vitest";
import { lostAcknowledgement, workerTurnsCanBeLost } from "#test/engineLostTurnTraits.ts";
import { engine } from "#test/engineStory.ts";
import { reviewerStillRunning, reviewRequestsRepairs } from "#test/engineTraits.ts";

for (const follow of [false, true]) {
	engine.it(
		`status and watch${follow ? " --follow" : ""} describe the lost turn's relaunch after restart`,
		[workerTurnsCanBeLost(), lostAcknowledgement()],
		function* ({ fleet, prepareWork, restart, loseTurn, status, watch }) {
			yield* prepareWork("one");
			loseTurn((yield* fleet.dispatch("one")).value.attempts.at(-1)?.sessionId);
			yield* fleet.reconcile("one");
			yield* restart();
			const visible = yield* status();
			expect(visible).toContain("Active (1)");
			expect(visible).toContain("one  executing");
			expect(visible).toContain("Lost turn relaunched.");
			expect(visible).toContain("no remote branch");
			const output = yield* watch(follow);
			expect(output.stdout).toContain("one executing: Lost turn relaunched.");
			expect(output.code).toBe(4);
			expect((yield* fleet.get("one")).value.releaseReason).toBeUndefined();
		},
	);
}

engine.it(
	"watch --follow prints the relaunch once while recovered work advances through review and delivery",
	[workerTurnsCanBeLost(), lostAcknowledgement(), reviewerStillRunning(), reviewRequestsRepairs()],
	function* ({ fleet, prepareWork, loseTurn, finishWorkers, status, storedSnapshot, watch }) {
		yield* prepareWork("one");
		loseTurn((yield* fleet.dispatch("one")).value.attempts.at(-1)?.sessionId);
		yield* fleet.reconcile("one");
		const executing = yield* storedSnapshot();
		expect(yield* status()).toContain("Lost turn relaunched.");
		finishWorkers();
		expect((yield* fleet.reconcile("one")).value.stage).toBe("reviewing");
		const reviewing = yield* storedSnapshot();
		const reviewStatus = yield* status();
		finishWorkers();
		const repair = (yield* fleet.reconcile("one")).value;
		expect(repair.stage).toBe("executing");
		expect(repair.attempts.at(-1)?.role).toBe("repair");
		const repairing = yield* storedSnapshot();
		const repairStatus = yield* status();
		finishWorkers();
		expect((yield* fleet.reconcile("one")).value.stage).toBe("reviewing");
		finishWorkers();
		expect((yield* fleet.reconcile("one")).value.stage).toBe("completed");
		const completed = yield* storedSnapshot();
		const output = yield* watch(true, [executing, reviewing, repairing, completed]);
		expect(output.stdout.match(/Lost turn relaunched\./gu)).toHaveLength(1);
		expect(output.stdout).toContain("one completed");
		expect(output.code).toBe(4);
		expect(reviewStatus).not.toContain("Lost turn relaunched.");
		expect(repairStatus).not.toContain("Lost turn relaunched.");
	},
);
