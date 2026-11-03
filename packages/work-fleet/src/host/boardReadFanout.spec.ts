import { expect } from "@effect/vitest";
import { boardReadDaemonStory } from "#test/boardReadDaemonStory.ts";

boardReadDaemonStory.it("startup and Board changes use the shared index across durable Fleet work", [], function* (daemon) {
	yield* daemon.start();
	yield* daemon.awaitReconciliation();

	daemon.approveWork("item.50");
	yield* daemon.awaitWorking("item.50");

	const status = yield* daemon.status();
	expect(status.completed.map(({ workId }) => workId).sort((left, right) => String(left).localeCompare(String(right)))).toEqual(
		Array.from({ length: 25 }, (_, index) => `item.${index}`).sort((left, right) => String(left).localeCompare(String(right))),
	);
	expect(status.active.map(({ workId }) => workId).sort((left, right) => String(left).localeCompare(String(right)))).toEqual(
		[...Array.from({ length: 10 }, (_, index) => `item.${index + 40}`), "item.50"].sort((left, right) => String(left).localeCompare(String(right))),
	);
	const running = daemon.counts();
	expect(daemon.peakPasses()).toEqual([]);
	expect(running.documents.peak).toBeLessThanOrEqual(16);
	expect(running.documents.completed).toBeLessThan(50);
	expect(running.passes.started).toBe(0);
	yield* daemon.stop();
	expect(daemon.counts().passes.live).toBe(0);
	expect(daemon.counts().documents.live).toBe(0);
});
