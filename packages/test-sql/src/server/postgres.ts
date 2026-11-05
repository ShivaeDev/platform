import { Effect, Layer, type Redacted, type Scope } from "effect";
import type { PostgresMigrationOptions } from "@shivaedev/sql/migrations.ts";
import type { PostgresOptions } from "@shivaedev/sql/postgresLayer.ts";
import { postgresTestContext } from "#server/adapters/postgresTestContext.ts";
import { connectionLimitHint } from "#server/connectionLimitHint.ts";
import type { PostgresTestServices } from "#server/database.ts";

export type PostgresTestLoader<E = never, R = never> = (
	url: Redacted.Redacted<string>,
) => Effect.Effect<unknown, E, R | PostgresTestServices | Scope.Scope>;

interface PostgresTestCommonOptions<E, TFixtures> extends PostgresOptions {
	readonly fixtures?: Effect.Effect<unknown, E, TFixtures | PostgresTestServices | Scope.Scope> | PostgresTestLoader<E, TFixtures>;
	readonly prepare?: boolean;
	readonly url: Redacted.Redacted<string>;
}

export type PostgresTestOptions<E = never, R = never, TFixtures = never> = PostgresTestCommonOptions<E, TFixtures> &
	(
		| { readonly migrations: PostgresMigrationOptions<R, E>; readonly initialize?: never }
		| {
				readonly initialize: Effect.Effect<unknown, E, R | PostgresTestServices | Scope.Scope> | PostgresTestLoader<E, R>;
				readonly migrations?: never;
		  }
	);

export function makePostgresTestLayer<E = never, R = never, TFixtures = never>(options: PostgresTestOptions<E, R, TFixtures>) {
	return Layer.effectContext(postgresTestContext(options).pipe(Effect.mapError(connectionLimitHint)));
}
