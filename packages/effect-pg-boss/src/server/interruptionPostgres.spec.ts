import { Effect, Schema } from "effect";
import { expect } from "vitest";
import { defineQueue } from "#definition.ts";
import { boss, realPostgres } from "#test/boss.ts";
import { eventually } from "#test/eventually.ts";
import { postgresConfigured } from "#test/postgresLayer.ts";

boss.it.runIf(postgresConfigured)(
	"keeps completed jobs and leaves the interrupted and remaining jobs active until expiry",
	[realPostgres],
	function* ({ boot, admin }) {
		const Queue = defineQueue({ name: "interrupted", queue: { expireInSeconds: 3, retryLimit: 0 }, schema: Schema.Struct({ id: Schema.Number }) });
		const client = yield* admin();
		const interrupted = Promise.withResolvers<void>();
		const handled: number[] = [];
		yield* Effect.promise(async () => {
			await client.createQueue(Queue.name, Queue.queueOptions);
			await client.insert(
				Queue.name,
				Array.from({ length: 3 }, (_, id) => ({ data: { id } })),
			);
		});
		yield* boot([
			Queue.handle(({ id }) =>
				Effect.suspend(() => {
					handled.push(id);
					if (handled.length === 2) {
						interrupted.resolve();
						return Effect.interrupt;
					}
					return Effect.void;
				}),
			),
		]);
		yield* Effect.promise(() => interrupted.promise);
		const read = Effect.promise(() => client.findJobs(Queue.name));
		const active = yield* read;
		expect(active.filter((job) => job.state === "completed")).toMatchObject([{ data: { id: handled[0] }, retryCount: 0 }]);
		expect(active.filter((job) => job.state === "active")).toHaveLength(2);
		const expired = yield* eventually(read, (jobs) => jobs.filter((job) => job.state === "failed").length === 2);
		expect(expired.filter((job) => job.state === "completed")).toMatchObject([{ data: { id: handled[0] }, retryCount: 0 }]);
		expect(expired.filter((job) => job.state === "failed").map((job) => job.output)).toMatchObject([
			{ message: "handler execution exceeded 3s" },
			{ message: "handler execution exceeded 3s" },
		]);
		expect(handled).toHaveLength(2);
	},
);
