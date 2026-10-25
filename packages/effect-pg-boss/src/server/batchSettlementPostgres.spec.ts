import { Effect, Schema } from "effect";
import { expect } from "vitest";
import { defineQueue } from "#definition.ts";
import { postgresIt, realPostgres } from "#test/boss.ts";

for (const readout of ["stale", "stalled"] as const) {
	postgresIt(
		`bounds settlement and logs a typed failure when claim reads are ${readout}`,
		[realPostgres],
		function* ({ boot, logs, native, observeSettlement, seed }) {
			const queue = defineQueue({ name: "settlement-bound", queue: { expireInSeconds: 1, retryLimit: 0 }, schema: Schema.Struct({}) });
			const client = native({ supervise: false });
			const probe = observeSettlement(client, { readout });
			yield* seed(queue, [{ data: {} }], client);
			yield* boot([queue.handle(() => Effect.never)], { clientFactory: () => probe.client });
			const fetched = yield* probe.fetched;
			const result = yield* probe.returned.pipe(Effect.timeout("4 seconds"));
			const deadline = Math.max(...fetched.map((job) => (job.startedOn?.getTime() ?? 0) + job.expireInSeconds * 1000));
			expect(result.at).toBeGreaterThanOrEqual(deadline);
			expect(result.at).toBeLessThan(deadline + 1500);
			expect(result.error).toMatchObject({
				_tag: "PgBossError",
				message: expect.stringContaining("TimeoutError"),
				operation: "settle",
				queue: queue.name,
			});
			expect(logs).toContainEqual({ logLevel: "Error", message: [result.error] });
			expect(probe.reads.length).toBeLessThan(20);
			expect(yield* Effect.promise(() => client.findJobs(queue.name))).toMatchObject([
				{ output: { message: "handler execution exceeded 1s" }, state: "failed" },
			]);
		},
	);
}

postgresIt(
	"skips an already expired job while settling a later job with a live budget",
	[realPostgres],
	function* ({ boot, native, observeSettlement, seed, untilJobs }) {
		const queue = defineQueue({ name: "expired-before-turn", queue: { retryLimit: 0 }, schema: Schema.Struct({ id: Schema.Number }) });
		const client = native({ supervise: false });
		const probe = observeSettlement(client, { waitForFirstExpiry: true });
		const handled: number[] = [];
		yield* seed(
			queue,
			[
				{ data: { id: 0 }, expireInSeconds: 1, priority: 1 },
				{ data: { id: 1 }, expireInSeconds: 3 },
			],
			client,
		);
		yield* boot([queue.handle(({ id }) => Effect.sync(() => handled.push(id)))], { clientFactory: () => probe.client });
		const active = yield* untilJobs<{ id: number }>(client, queue.name, (jobs) => jobs.some((job) => job.state === "completed"));
		expect(active.find((job) => job.data.id === 0)).toMatchObject({ state: "active" });
		expect(active.find((job) => job.data.id === 1)).toMatchObject({ state: "completed" });
		expect(handled).toEqual([1]);
		expect(probe.results).toEqual([]);
		expect((yield* probe.returned).error).toBeUndefined();
		const settled = yield* Effect.promise(() => client.findJobs<{ id: number }>(queue.name));
		expect(settled.find((job) => job.data.id === 0)).toMatchObject({ output: { message: "handler execution exceeded 3s" }, state: "failed" });
		expect(settled.find((job) => job.data.id === 1)).toMatchObject({ state: "completed" });
	},
);

for (const outcome of ["self interruption", "aborted signal"] as const) {
	postgresIt(
		`leaves interrupted and remaining jobs to pg-boss expiry after ${outcome}`,
		[realPostgres],
		function* ({ boot, native, observeSettlement, seed }) {
			const queue = defineQueue({
				name: "remaining-jobs",
				queue: { expireInSeconds: 2, retryLimit: 0 },
				schema: Schema.Struct({ id: Schema.Number }),
			});
			const client = native({ supervise: false });
			const probe = observeSettlement(client);
			const entered = Promise.withResolvers<void>();
			const handled: number[] = [];
			yield* seed(
				queue,
				Array.from({ length: 3 }, (_, id) => ({ data: { id }, priority: -id })),
				client,
			);
			const worker = queue.handle(({ id }) =>
				Effect.suspend(() => {
					handled.push(id);
					if (id !== 1) {
						return Effect.void;
					}
					entered.resolve();
					return outcome === "self interruption" ? Effect.interrupt : Effect.never;
				}),
			);
			yield* boot([worker], { clientFactory: () => probe.client });
			yield* Effect.promise(() => entered.promise);
			if (outcome === "aborted signal") {
				yield* probe.abort;
			}
			const active = yield* Effect.promise(() => client.findJobs<{ id: number }>(queue.name));
			expect(active.find((job) => job.data.id === 0)).toMatchObject({ state: "completed" });
			expect(active.filter((job) => job.data.id !== 0)).toMatchObject([{ state: "active" }, { state: "active" }]);
			expect(probe.results).toEqual([]);
			expect((yield* probe.returned).error).toBeUndefined();
			const settled = yield* Effect.promise(() => client.findJobs<{ id: number }>(queue.name));
			expect(settled.find((job) => job.data.id === 0)).toMatchObject({ state: "completed" });
			expect(settled.filter((job) => job.data.id !== 0)).toMatchObject([
				{ output: { message: "handler execution exceeded 2s" }, state: "failed" },
				{ output: { message: "handler execution exceeded 2s" }, state: "failed" },
			]);
			expect(handled).toEqual([0, 1]);
		},
	);
}
