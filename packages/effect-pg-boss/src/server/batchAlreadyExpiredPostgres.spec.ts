import { setImmediate } from "node:timers/promises";
import { Clock, Effect } from "effect";
import { expect, vi } from "vitest";
import { batchHandler } from "#internal/batchHandler.ts";
import { boss, realPostgres } from "#test/boss.ts";
import { postgresConfigured } from "#test/postgresLayer.ts";

boss.it.runIf(postgresConfigured)(
	"does not start or settle a fetched job whose window passed before the callback",
	[realPostgres],
	function* ({ admin }) {
		const name = "already-expired";
		const client = yield* admin({ supervise: false });
		const handled = vi.fn();
		const returned = vi.fn();
		yield* Effect.promise(async () => {
			await client.createQueue(name, { expireInSeconds: 1, retryLimit: 0 });
			await client.send(name, {});
		});
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
	},
);
