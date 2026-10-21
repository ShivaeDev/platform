import { Effect, Fiber, Option, Schema } from "effect";
import { expect } from "vitest";
import { defineQueue } from "#definition.ts";
import { schemaIt } from "#test/schemaStories.ts";

schemaIt(
	"retries a cancelled concurrent upgrade by repairing invalid and missing indexes",
	[],
	function* ({ boot, holdIndexBuild, installSchema, query, rollbackSchema, untilJob }) {
		yield* installSchema({ schema: "jobs_test" });
		const queue = defineQueue({ name: "recover", queue: { partition: true }, schema: Schema.Struct({ value: Schema.Number }) });
		const producer = yield* boot([queue], { migrate: false });
		yield* producer.stop;
		yield* rollbackSchema("jobs_test", 45);
		const held = yield* holdIndexBuild();
		const upgrade = yield* installSchema({ schema: "jobs_test" }).pipe(Effect.forkChild);
		yield* held.cancel;
		expect(yield* Fiber.join(upgrade).pipe(Effect.flip)).toMatchObject({ _tag: "PgBossError", operation: "install" });
		yield* held.release;
		expect(yield* query("SELECT version FROM jobs_test.version")).toEqual([{ version: 46 }]);
		expect(
			yield* query(
				"SELECT indexrelid::regclass::text AS name, indisvalid AS valid FROM pg_index WHERE indexrelid = to_regclass('jobs_test.job_common_i13')",
			),
		).toEqual([{ name: "jobs_test.job_common_i13", valid: false }]);
		yield* installSchema({ schema: "jobs_test" });
		expect(
			yield* query(
				"SELECT indisvalid AS valid FROM pg_index JOIN pg_class ON pg_class.oid = indexrelid JOIN pg_namespace ON pg_namespace.oid = relnamespace WHERE nspname = 'jobs_test' AND relname LIKE '%i13'",
			),
		).toEqual([{ valid: true }, { valid: true }]);
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
		const id = Option.getOrThrow(yield* worker.jobs.enqueue(queue, { value: 42 }));
		yield* untilJob(worker.jobs, queue, id, "completed");
		expect(handled).toEqual([42]);
	},
);
