import { expect } from "@effect/vitest";
import { task } from "#test/fleetHost.ts";
import { idleHost } from "#test/idleScheduler.ts";

idleHost.it("idle Fleet skips admission and reconciliation until its next due observation wakes one pass", [], function* ({ startIdleScheduler }) {
	const scheduler = yield* startIdleScheduler();
	const startupPasses = yield* scheduler.passes();
	expect(startupPasses).toBeGreaterThan(0);

	yield* scheduler.elapseBeforeObservation();

	expect(yield* scheduler.passes()).toBe(startupPasses);
	expect(scheduler.reconciledWork()).toEqual([]);

	yield* scheduler.observationBecomesDue();

	expect(yield* scheduler.passes()).toBe(startupPasses + 1);
	expect(scheduler.reconciledWork()).toEqual([]);
});

idleHost.it("a committed admission dispatches work before the next observation is due", [], function* (daemon) {
	yield* daemon.startIdleScheduler();
	daemon.writeBoard("one.md", task("one", "approved"));

	yield* daemon.admit();

	const working = yield* daemon.waitForRecord("one", (record) => record.attempts[0]?.receipt !== undefined);
	expect(daemon.providerStarts()).toMatchObject([{ operationId: working.attempts[0]?.operationId }]);
	expect(working.step).toBe("working");
});
