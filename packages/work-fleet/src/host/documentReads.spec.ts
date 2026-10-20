import { expect } from "@effect/vitest";
import { changingCloudWorkers } from "#test/changingCloudWorkers.ts";
import { host } from "#test/hostStory.ts";

const CYCLES = 40;
const WORKERS = ["item.0", "item.1", "item.2", "item.3"];
const MAX_IN_FLIGHT_SNAPSHOTS = 8;

host.it(
	"expired passes release Board snapshots while changing-progress callbacks keep their contexts",
	[changingCloudWorkers],
	function* (daemon) {
		yield* daemon.schedulerPass();
		for (const id of WORKERS) {
			yield* daemon.waitForRecord(id, (record) => record.attempts.at(-1)?.receipt !== undefined);
		}
		for (let cycle = 0; cycle < CYCLES; cycle += 1) {
			yield* daemon.schedulerPass();
		}
		for (const id of WORKERS) {
			const worker = yield* daemon.get(id);
			expect(worker.stage).toBe("executing");
			expect(worker.attempts.at(-1)?.progress?.signature).toContain("progress-");
		}
		expect(daemon.workerContextCount()).toBeGreaterThan(CYCLES);
		expect(yield* daemon.retainedBoardSnapshots()).toBeLessThanOrEqual(MAX_IN_FLIGHT_SNAPSHOTS);
	},
	90_000,
);
