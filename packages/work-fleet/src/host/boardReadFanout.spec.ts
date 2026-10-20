import { expect } from "@effect/vitest";
import { boardReadDaemonStory } from "#test/boardReadDaemonStory.ts";

const COMPLETED_RECORDS = 25;
const ACTIVE_RECORDS = 10;
const SINGLE_PASS = 1;
const NO_LIVE_READS = 0;

boardReadDaemonStory.it("startup and reconciliation share full Board reads across a night of durable Fleet work", [], function* (daemon) {
	yield* daemon.start();
	yield* daemon.awaitCycles(3);
	const status = yield* daemon.status();
	expect(status.completed).toHaveLength(COMPLETED_RECORDS);
	expect(status.active).toHaveLength(ACTIVE_RECORDS);
	const running = daemon.counts();
	expect(running.passes.peak).toBe(SINGLE_PASS);
	expect(running.documents.peak).toBeLessThanOrEqual(16);
	expect(running.documents.completed).toBeGreaterThanOrEqual(900);
	expect(running.passes.started).toBeLessThan(running.reconciles);
	yield* daemon.stop();
	expect(daemon.counts().passes.live).toBe(NO_LIVE_READS);
	expect(daemon.counts().documents.live).toBe(NO_LIVE_READS);
});
