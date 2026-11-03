import { Clock, Context, Effect, Layer, type Redacted, type Scope } from "effect";
import { migratePostgres, type PostgresMigrationOptions } from "@shivaedev/sql/migrations.ts";
import { type PostgresOptions, postgresLayer } from "@shivaedev/sql/postgresLayer.ts";
import { PostgresTestDatabase, type PostgresTestDatabaseService, type PostgresTestServices } from "#server/database.ts";
import { connectionLimitHint } from "#server/internal/connectionLimitHint.ts";
import { databaseCleanup } from "#server/internal/databaseCleanup.ts";
import { database } from "#server/internal/databases.ts";

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

function runLoader<E, R>(
	loader: Effect.Effect<unknown, E, R> | ((url: Redacted.Redacted<string>) => Effect.Effect<unknown, E, R>),
	url: Redacted.Redacted<string>,
) {
	return typeof loader === "function" ? loader(url) : loader;
}

export function makePostgresTestLayer<E = never, R = never, TFixtures = never>(options: PostgresTestOptions<E, R, TFixtures>) {
	return Layer.effectContext(
		Effect.gen(function* () {
			const connectionOptions = { ...options, maxConnections: options.maxConnections ?? 2 };
			const { awaitCleanup, release } = yield* databaseCleanup(options.url, connectionOptions);
			const empty = yield* database(options.url, release, undefined, connectionOptions);
			const template = options.prepare === false ? empty : yield* database(options.url, release, empty.name, connectionOptions);
			if (options.prepare !== false) {
				yield* Effect.scoped(
					Effect.gen(function* () {
						const services = yield* Layer.build(postgresLayer(template.url, connectionOptions));
						const initialize = options.initialize;
						if (initialize === undefined) {
							yield* migratePostgres(options.migrations).pipe(Effect.provideContext(services));
						} else {
							yield* runLoader(initialize, template.url).pipe(Effect.provideContext(services));
						}
						if (options.fixtures !== undefined) {
							yield* runLoader(options.fixtures, template.url).pipe(Effect.provideContext(services));
						}
					}),
				);
			}
			const shared = yield* database(options.url, release, template.name, connectionOptions);
			const services = yield* Layer.build(postgresLayer(shared.url, connectionOptions));
			const clone: PostgresTestDatabaseService["clone"] = (source) =>
				Effect.gen(function* () {
					const target = yield* database(options.url, release, source === "empty" ? empty.name : template.name, connectionOptions);
					const context = yield* Layer.build(
						postgresLayer(target.url, connectionOptions).pipe(Layer.provide(Layer.succeed(Clock.Clock, Clock.Clock.defaultValue()))),
					);
					return Context.add(context, PostgresTestDatabase, { awaitCleanup, clone, isolated, url: target.url });
				});
			const isolated = clone("migrated");
			return Context.add(services, PostgresTestDatabase, { awaitCleanup, clone, isolated, url: shared.url });
		}).pipe(Effect.mapError(connectionLimitHint)),
	);
}
