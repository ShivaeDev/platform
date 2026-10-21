import { DateTime, Effect, Option, Schema } from "effect";
import { expect } from "vitest";
import { defineQueue, RetryAt } from "#definition.ts";
import { installedTemplate, schemaIt } from "#test/schemaStories.ts";

schemaIt(
	"installs a template without workers or schedules and a clone processes deferrals without schema work",
	[installedTemplate],
	function* ({ boot, query, untilJob }) {
		expect(yield* query("SELECT name FROM jobs_test.queue")).toEqual([]);
		expect(yield* query("SELECT name FROM jobs_test.schedule")).toEqual([]);
		expect(yield* query("SELECT id FROM jobs_test.instance")).toEqual([]);
		const queue = defineQueue({ name: "installed", schema: Schema.Struct({ value: Schema.Number }), worker: { pollingIntervalSeconds: 0.5 } });
		const handled: number[] = [];
		const worker = yield* boot(
			[
				queue.handle(({ value }) =>
					Effect.gen(function* () {
						handled.push(value);
						if (handled.length === 1) {
							yield* new RetryAt({ at: DateTime.makeUnsafe(0), reason: "next fetch" });
						}
					}),
				),
			],
			{ migrate: false },
		);
		const id = Option.getOrThrow(yield* worker.jobs.enqueue(queue, { value: 42 }));
		expect(yield* untilJob(worker.jobs, queue, id, "completed")).toMatchObject({ data: { value: 42 }, id, retryCount: 0, state: "completed" });
		expect(handled).toEqual([42, 42]);
	},
);

schemaIt("cannot start a queue with migrations disabled in an empty database", [], function* ({ boot }) {
	expect(yield* boot([], { migrate: false }).pipe(Effect.flip)).toMatchObject({ _tag: "PgBossError", operation: "start" });
});

schemaIt("installs the default schema and preserves queued jobs on repeated installation", [], function* ({ boot, installSchema, untilJob }) {
	yield* installSchema();
	const queue = defineQueue({ name: "preserved", schema: Schema.Struct({ value: Schema.Number }) });
	const producer = yield* boot([queue], { migrate: false, schema: "pgboss" });
	const id = Option.getOrThrow(yield* producer.jobs.enqueue(queue, { value: 7 }));
	yield* producer.stop;
	yield* installSchema();
	const handled: number[] = [];
	const worker = yield* boot(
		[
			queue.handle(({ value }) =>
				Effect.sync(() => {
					handled.push(value);
				}),
			),
		],
		{ migrate: false, schema: "pgboss" },
	);
	yield* untilJob(worker.jobs, queue, id, "completed");
	expect(handled).toEqual([7]);
});

schemaIt(
	"upgrades an older schema including its concurrent partition indexes without a worker",
	[],
	function* ({ boot, installSchema, query, rollbackSchema }) {
		yield* installSchema({ schema: "jobs_test" });
		const queue = defineQueue({ name: "partitioned", queue: { partition: true }, schema: Schema.Struct({}) });
		const producer = yield* boot([queue], { migrate: false });
		yield* producer.stop;
		yield* rollbackSchema("jobs_test", 45);
		expect(yield* query("SELECT version FROM jobs_test.version")).toEqual([{ version: 44 }]);
		yield* installSchema({ schema: "jobs_test" });
		expect(yield* query("SELECT version FROM jobs_test.version")).toEqual([{ version: 46 }]);
		expect(yield* query("SELECT indexname FROM pg_indexes WHERE schemaname = 'jobs_test' AND indexname LIKE '%i13' ORDER BY indexname")).toHaveLength(
			2,
		);
		yield* boot([queue], { migrate: false });
	},
);

schemaIt("reports installation failures through the typed error channel and leaves the connection usable", [], function* ({ installSchema, query }) {
	expect(yield* installSchema({ schema: "invalid.schema" }).pipe(Effect.flip)).toMatchObject({ _tag: "PgBossError", operation: "install" });
	yield* query("CREATE SCHEMA broken");
	yield* query("CREATE TABLE broken.version (version int)");
	yield* query("INSERT INTO broken.version VALUES (44)");
	expect(yield* installSchema({ schema: "broken" }).pipe(Effect.flip)).toMatchObject({ _tag: "PgBossError", operation: "install" });
	yield* installSchema();
	expect(yield* query("SELECT version FROM pgboss.version")).toEqual([{ version: 46 }]);
});
