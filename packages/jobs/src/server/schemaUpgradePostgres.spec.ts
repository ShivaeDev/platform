import { Effect, Option, Schema } from "effect";
import { expect } from "vitest";
import { defineQueue } from "#definition.ts";
import { schemaIt } from "#test/schemaStories.ts";

schemaIt(
	"preserves queued work through the schema component upgrade before starting workers",
	[],
	function* ({ boot, migrateSchema, checkSchema, query, rollbackSchema, untilJob }) {
		yield* migrateSchema({ schema: "jobs_test" });
		const queue = defineQueue({ name: "upgrade", queue: { partition: true }, schema: Schema.Struct({ value: Schema.Number }) });
		const producer = yield* boot([queue], { migrate: false });
		const id = Option.getOrThrow(yield* producer.jobs.enqueue(queue, { value: 42 }));
		yield* producer.stop;
		yield* rollbackSchema("jobs_test", 46);
		expect(yield* query("SELECT version FROM jobs_test.version")).toEqual([{ version: 45 }]);
		const pending = yield* checkSchema({ schema: "jobs_test" }).pipe(Effect.result);
		expect(pending).toMatchObject({
			_tag: "Failure",
			failure: { kind: "BadState", message: expect.stringContaining("installed version 45, required version 46") },
		});
		yield* migrateSchema({ schema: "jobs_test" });
		expect(yield* query("SELECT version FROM jobs_test.version")).toEqual([{ version: 46 }]);
		yield* checkSchema({ schema: "jobs_test" });
		expect(
			yield* query(
				"SELECT count(*)::int AS count, bool_and(indisvalid) AS valid FROM pg_index JOIN pg_class ON pg_class.oid = indexrelid JOIN pg_namespace ON pg_namespace.oid = relnamespace WHERE nspname = 'jobs_test' AND relname ~ '_i1[4-7]$'",
			),
		).toEqual([{ count: 8, valid: true }]);
		const handled: number[] = [];
		const worker = yield* boot(
			[
				queue.handle(({ value }) =>
					Effect.sync(() => {
						handled.push(value);
					}),
				),
			],
			{ migrate: false },
		);
		yield* untilJob(worker.jobs, queue, id, "completed");
		expect(handled).toEqual([42]);
	},
);
