import { setImmediate } from "node:timers/promises";
import { Clock, Effect, Schema } from "effect";
import { expect, vi } from "vitest";
import { defineQueue, defineSchedule } from "#definition.ts";
import { boss } from "#test/boss.ts";
import { job } from "#test/fakeClient.ts";

boss.it("skips an already expired job while settling a later job with a live budget", [], function* ({ boot, client, dispatch }) {
	const Queue = defineQueue({ name: "expired-before-turn", schema: Schema.Struct({ id: Schema.Number }) });
	const handled: number[] = [];
	const now = yield* Clock.currentTimeMillis;
	const expired = { ...job(Queue.name, { id: 0 }), expireInSeconds: 1, startedOn: new Date(now - 2000) };
	const live = { ...job(Queue.name, { id: 1 }), id: "live" };
	const returned = vi.fn();
	yield* boot([Queue.handle(({ id }) => Effect.sync(() => handled.push(id)))]);
	yield* dispatch(Queue.name, [expired, live]).pipe(
		Effect.onExit(() => Effect.sync(() => returned())),
		Effect.forkChild,
	);
	yield* Effect.promise(setImmediate);
	expect(handled).toEqual([1]);
	expect(client.completeCalls).toEqual([{ job: live, name: Queue.name }]);
	expect(client.failCalls).toEqual([]);
	expect(returned).not.toHaveBeenCalled();
});

boss.it("interrupts scheduled effects at their own deadline without settling their batch", [], function* ({ boot, client, dispatch }) {
	const Schedule = defineSchedule({ cron: "0 * * * *", name: "scheduled-expiry" });
	const interrupted = Promise.withResolvers<void>();
	const returned = vi.fn();
	yield* boot([Schedule.run(Effect.never.pipe(Effect.onInterrupt(() => Effect.sync(() => interrupted.resolve()))))]);
	yield* dispatch(Schedule.name, [{ ...job(Schedule.name, null), expireInSeconds: 0.05 }]).pipe(
		Effect.onExit(() => Effect.sync(() => returned())),
		Effect.forkChild,
	);
	yield* Effect.promise(() => interrupted.promise);
	yield* Effect.promise(setImmediate);
	expect(client.completeCalls).toEqual([]);
	expect(client.failCalls).toEqual([]);
	expect(returned).not.toHaveBeenCalled();
});
