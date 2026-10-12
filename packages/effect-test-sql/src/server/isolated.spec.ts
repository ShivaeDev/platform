import { Cause, Context, Deferred, Effect, Exit, Fiber, Layer, Redacted } from "effect";
import { SqlClient } from "effect/unstable/sql";
import { expect } from "vitest";
import { committingClone } from "#test/committingClone.ts";
import { integration, runAdmin, runDatabase, setup, values } from "#test/postgres.ts";
import { PostgresTestDatabase } from "./database.ts";
import { makePostgresTestLayer } from "./postgres.ts";
import { withIsolatedDatabase } from "./withIsolatedDatabase.ts";

integration("isolated databases clone prepared fixtures once, commit for real, and drop after use", async () => {
	const kit = setup();
	await Effect.runPromise(
		Effect.scoped(
			Effect.gen(function* () {
				const shared = yield* SqlClient.SqlClient;
				yield* shared`update items set value = 'shared'`;
				const names: string[] = [];

				yield* Effect.all([committingClone("a", names), committingClone("b", names)], { concurrency: "unbounded" });
				expect(new Set(names).size).toBe(2);
				expect(yield* shared`select datname from pg_database where ${shared.in("datname", names)}`).toEqual([]);
				expect(yield* values).toEqual([{ value: "shared" }]);
				expect(kit.counts).toEqual({ fixtures: 1, migrations: 1 });
			}),
		).pipe(Effect.provide(kit.layer)),
	);
});

integration("isolated databases clean up after typed failure, defects and interruption", async () => {
	await runDatabase(
		Effect.gen(function* () {
			const shared = yield* SqlClient.SqlClient;
			const names: string[] = [];
			const entered = yield* Deferred.make<void>();
			function record() {
				return Effect.gen(function* () {
					const sql = yield* SqlClient.SqlClient;
					const [row] = yield* sql<{ name: string }>`select current_database() as name`;
					names.push(row?.name ?? "");
					yield* sql`update items set value = 'committed'`;
				});
			}
			expect(yield* withIsolatedDatabase(Effect.andThen(record(), Effect.fail("rejected"))).pipe(Effect.flip)).toBe("rejected");
			const defect = yield* withIsolatedDatabase(Effect.andThen(record(), Effect.die("assertion"))).pipe(Effect.exit);
			expect(Exit.isFailure(defect) && Cause.hasDies(defect.cause)).toBe(true);
			const fiber = yield* withIsolatedDatabase(
				Effect.gen(function* () {
					yield* record();
					yield* Deferred.succeed(entered, undefined);
					yield* Effect.never;
				}),
			).pipe(Effect.forkScoped);
			yield* Deferred.await(entered);
			yield* Fiber.interrupt(fiber);
			expect(yield* shared`select datname from pg_database where ${shared.in("datname", names)}`).toEqual([]);
		}).pipe(Effect.timeout("5 seconds")),
	);
});

integration("closing the worker scope drops both the template and shared database", async () => {
	await runAdmin(
		Effect.gen(function* () {
			const admin = yield* SqlClient.SqlClient;
			const names: string[] = [];
			const kit = setup();
			const options = {
				...kit.options,
				fixtures: Effect.gen(function* () {
					yield* kit.options.fixtures;
					const sql = yield* SqlClient.SqlClient;
					const [row] = yield* sql<{ name: string }>`select current_database() as name`;
					names.push(row?.name ?? "");
				}),
			};
			yield* Effect.scoped(
				Effect.gen(function* () {
					const context = yield* Layer.build(makePostgresTestLayer(options));
					names.push(new URL(Redacted.value(Context.get(context, PostgresTestDatabase).url)).pathname.slice(1));
					expect(yield* admin`select datname from pg_database where ${admin.in("datname", names)}`).toHaveLength(2);
				}),
			);
			expect(yield* admin`select datname from pg_database where ${admin.in("datname", names)}`).toEqual([]);
		}),
	);
});
