import type * as PgClient from "@effect/sql-pg/PgClient";
import { Context, type Effect, type Redacted, type Scope } from "effect";
import type * as Reactivity from "effect/reactivity/Reactivity";
import type { SqlClient } from "effect/sql";
import type { SqlError } from "effect/sql/SqlError";

export type PostgresTestServices = PgClient.PgClient | SqlClient.SqlClient | Reactivity.Reactivity;

export interface PostgresTestDatabaseService {
	readonly isolated: Effect.Effect<Context.Context<PostgresTestServices | PostgresTestDatabase>, SqlError, Scope.Scope>;
	readonly url: Redacted.Redacted<string>;
}

export class PostgresTestDatabase extends Context.Service<PostgresTestDatabase, PostgresTestDatabaseService>()(
	"@shivaedev/effect-test-sql/PostgresTestDatabase",
) {}
