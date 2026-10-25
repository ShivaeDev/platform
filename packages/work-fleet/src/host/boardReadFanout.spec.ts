import { expect } from "@effect/vitest";
import { boardReadDaemonStory } from "#test/boardReadDaemonStory.ts";

boardReadDaemonStory.it("startup and reconciliation share full Board reads across a night of durable Fleet work", [], function* (daemon) {
	yield* daemon.start();
	yield* daemon.awaitCycles(3);
	const status = yield* daemon.status();
	expect(status.completed.map(({ workId }) => workId).sort((left, right) => String(left).localeCompare(String(right)))).toEqual(
		Array.from({ length: 25 }, (_, index) => `item.${index}`).sort((left, right) => String(left).localeCompare(String(right))),
	);
	expect(status.active.map(({ workId }) => workId).sort((left, right) => String(left).localeCompare(String(right)))).toEqual(
		Array.from({ length: 10 }, (_, index) => `item.${index + 40}`).sort((left, right) => String(left).localeCompare(String(right))),
	);
	const running = daemon.counts();
	expect(daemon.peakPasses()).toEqual(["FleetBoard.readDocuments"]);
	expect(running.documents.peak).toBeLessThanOrEqual(16);
	expect(running.documents.completed).toBeGreaterThanOrEqual(900);
	expect(running.passes.started).toBeLessThan(running.reconciles);
	yield* daemon.stop();
	expect(daemon.counts().passes.live).toBe(0);
	expect(daemon.counts().documents.live).toBe(0);
});
