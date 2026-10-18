import { setImmediate } from "node:timers/promises";
import { Clock, Effect, Schema } from "effect";
import { expect, vi } from "vitest";
import { defineQueue } from "#definition.ts";
import { batchHandler } from "#internal/batchHandler.ts";
import { postgresIt, realPostgres } from "#test/boss.ts";

postgresIt("does not start or settle a fetched job whose window passed before the callback", [realPostgres], function* ({ native, seed }) {
	const Queue = defineQueue({ name: "already-expired", queue: { expireInSeconds: 1, retryLimit: 0 }, schema: Schema.Struct({}) });
	const name = Queue.name;
	const client = native({ supervise: false });
	const handled = vi.fn();
	const returned = vi.fn();
	yield* seed(Queue, [{ data: {} }], client);
	const fetched = yield* Effect.promise(() => client.fetch(name, { includeMetadata: true }));
	const first = fetched[0];
	expect(first).toBeDefined();
	if (first === undefined) {
		throw new Error("Expected a fetched job");
	}
	const deadline = first.startedOn.getTime() + first.expireInSeconds * 1000;
	const now = yield* Clock.currentTimeMillis;
	yield* Effect.sleep(Math.max(0, deadline - now) + 50);
	const jobs = fetched.map((job) => ({ ...job, signal: new AbortController().signal }));
	yield* Effect.promise(() => batchHandler(client, name, () => Effect.sync(handled))(jobs)).pipe(
		Effect.onExit(() => Effect.sync(() => returned())),
		Effect.forkChild,
	);
	yield* Effect.promise(setImmediate);
	expect(handled).not.toHaveBeenCalled();
	expect(returned).not.toHaveBeenCalled();
	expect((yield* Effect.promise(() => client.findJobs(name))).some((job) => job.state === "completed")).toBe(false);
});
