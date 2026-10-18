import { Effect, Exit, Redacted } from "effect";
import { SqlClient } from "effect/sql";
import { expect } from "vitest";
import { limitedRole } from "#test/limitedRole.ts";
import { integration, runAdmin, setup } from "#test/postgres.ts";
import { PostgresTestDatabase } from "./database.ts";
import { makePostgresTestLayer } from "./postgres.ts";
import { withIsolatedDatabase } from "./withIsolatedDatabase.ts";

integration("an isolated database drop failure ends its scope with a SQL defect", async () => {
	await runAdmin(
		Effect.gen(function* () {
			const admin = yield* SqlClient.SqlClient;
			const url = yield* limitedRole(2);
			const role = new URL(Redacted.value(url)).username;
			let name = "";
			const cleanup = Effect.gen(function* () {
				yield* admin`alter role ${admin(role)} connection limit 2`;
				if (name !== "") {
					yield* admin`drop database if exists ${admin(name)} with (force)`;
				}
			});
			yield* Effect.scoped(
				Effect.gen(function* () {
					yield* Effect.addFinalizer(() => Effect.orDie(cleanup));
					const exit = yield* withIsolatedDatabase(
						Effect.gen(function* () {
							const database = yield* PostgresTestDatabase;
							name = new URL(Redacted.value(database.url)).pathname.slice(1);
							yield* admin`alter role ${admin(role)} connection limit 0`;
						}),
					).pipe(Effect.exit);
					expect(Exit.isFailure(exit) && exit.cause.reasons).toMatchObject([
						{ _tag: "Die", defect: { _tag: "SqlError", reason: { cause: { code: "53300" } } } },
					]);
					expect(yield* admin`select datname from pg_database where datname = ${name}`).toEqual([{ datname: name }]);
				}),
			).pipe(Effect.provide(makePostgresTestLayer({ ...setup().options, url })));
			expect(yield* admin`select datname from pg_database where datname = ${name}`).toEqual([]);
		}),
	);
});
