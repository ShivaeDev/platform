import * as PgClient from "@effect/sql-pg/PgClient";
import { Context, Effect, Layer, Redacted, Scope } from "effect";
import * as Reactivity from "effect/unstable/reactivity/Reactivity";
import { Migrator, SqlClient } from "effect/unstable/sql";
import type { SqlError } from "effect/unstable/sql/SqlError";
import { expectTypeOf } from "vitest";
import { makeEffectIt } from "@shivaedev/effect-test/vitest.ts";
import type { PostgresTestDatabase, PostgresTestServices } from "./database.ts";
import { makePostgresTestLayer } from "./postgres.ts";
import { withIsolatedDatabase } from "./withIsolatedDatabase.ts";
import { withTestTransaction } from "./withTestTransaction.ts";

class Missing extends Context.Service<Missing, string>()("@types/Missing") {}

const body = Effect.gen(function* () {
	yield* Scope.Scope;
	yield* Missing;
	return yield* Effect.succeed(42);
});
const rollback = withTestTransaction(body);
expectTypeOf<Effect.Success<typeof rollback>>().toEqualTypeOf<number>();
expectTypeOf<Effect.Error<typeof rollback>>().toEqualTypeOf<SqlError>();
expectTypeOf<Effect.Services<typeof rollback>>().toEqualTypeOf<Missing | SqlClient.SqlClient | Reactivity.Reactivity>();

const isolated = withIsolatedDatabase(
	Effect.gen(function* () {
		yield* PgClient.PgClient;
		yield* SqlClient.SqlClient;
		yield* Reactivity.Reactivity;
		yield* Missing;
		return yield* Effect.fail("refused" as const);
	}),
);
expectTypeOf<Effect.Error<typeof isolated>>().toEqualTypeOf<"refused" | SqlError>();
expectTypeOf<Effect.Services<typeof isolated>>().toEqualTypeOf<Missing | PostgresTestDatabase>();

const options = {
	migrations: { loader: Migrator.fromRecord({}), lockTimeout: "5 seconds" as const },
	url: Redacted.make("postgresql://typecheck"),
};
const layer = makePostgresTestLayer(options);
expectTypeOf<Layer.Services<typeof layer>>().toEqualTypeOf<never>();
expectTypeOf<Layer.Success<typeof layer>>().toEqualTypeOf<PostgresTestServices | PostgresTestDatabase>();
const required = makePostgresTestLayer({ ...options, fixtures: Effect.service(Missing) });
expectTypeOf<Layer.Services<typeof required>>().toEqualTypeOf<Missing>();

const { effectApp } = makeEffectIt({
	around: withTestTransaction,
	layer,
	makeHarness: () => Effect.map(SqlClient.SqlClient, (sql) => ({ sql })),
});
effectApp("keeps SQL harness types", function* ({ sql }) {
	expectTypeOf(sql).toEqualTypeOf<SqlClient.SqlClient>();
	yield* Scope.Scope;
	yield* withIsolatedDatabase(Effect.service(PgClient.PgClient));
});
// @ts-expect-error The PostgreSQL test Layer does not supply Missing.
effectApp("rejects an unmet body service", function* () {
	return yield* Missing;
});

makeEffectIt({ around: withIsolatedDatabase, layer, makeHarness: () => Effect.void });
// @ts-expect-error An isolated wrapper needs the database service.
makeEffectIt({ around: withIsolatedDatabase, layer: Layer.empty, makeHarness: () => Effect.void });
