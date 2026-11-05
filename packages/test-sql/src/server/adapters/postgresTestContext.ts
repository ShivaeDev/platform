import { Clock, Context, Effect, Layer, type Redacted } from "effect";
import { migratePostgres } from "@shivaedev/sql/migrations.ts";
import { postgresLayer } from "@shivaedev/sql/postgresLayer.ts";
import { PostgresTestDatabase, type PostgresTestDatabaseService } from "#server/database.ts";
import { databaseCleanup } from "#server/databaseCleanup.ts";
import { database } from "#server/databases.ts";
import type { PostgresTestOptions } from "#server/postgres.ts";

function runLoader<E, R>(
	loader: Effect.Effect<unknown, E, R> | ((url: Redacted.Redacted<string>) => Effect.Effect<unknown, E, R>),
	url: Redacted.Redacted<string>,
) {
	return typeof loader === "function" ? loader(url) : loader;
}

export const postgresTestContext = Effect.fnUntraced(function* <E = never, R = never, TFixtures = never>(
	options: PostgresTestOptions<E, R, TFixtures>,
) {
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
});
