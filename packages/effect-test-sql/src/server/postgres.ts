import { Context, Effect, Layer, type Redacted, type Scope } from "effect";
import * as Reactivity from "effect/reactivity/Reactivity";
import type { SqlNameTransforms } from "@shivaedev/effect-sql/clientOptions.ts";
import { migratePostgres, type PostgresMigrationOptions } from "@shivaedev/effect-sql/migrations.ts";
import { PostgresTestDatabase, type PostgresTestDatabaseService, type PostgresTestServices } from "#database.ts";
import { connectionLimitHint } from "#internal/connectionLimitHint.ts";
import { databaseCleanup } from "#internal/databaseCleanup.ts";
import { connection, database } from "#internal/databases.ts";

export type PostgresTestLoader<E = never, R = never> = (
	url: Redacted.Redacted<string>,
) => Effect.Effect<unknown, E, R | PostgresTestServices | Scope.Scope>;

export interface PostgresTestOptions<E = never, R = never, TFixtures = never> extends SqlNameTransforms {
	readonly fixtures?: Effect.Effect<unknown, E, TFixtures | PostgresTestServices | Scope.Scope> | PostgresTestLoader<E, TFixtures>;
	readonly maxConnections?: number;
	readonly migrations: PostgresMigrationOptions<R>;
	readonly prepare?: boolean;
	readonly url: Redacted.Redacted<string>;
}

export function makePostgresTestLayer<E = never, R = never, TFixtures = never>(options: PostgresTestOptions<E, R, TFixtures>) {
	return Layer.effectContext(
		Effect.gen(function* () {
			const maxConnections = options.maxConnections ?? 2;
			const { awaitCleanup, release } = yield* databaseCleanup(options.url);
			const empty = yield* database(options.url, release);
			const template = options.prepare === false ? empty : yield* database(options.url, release, empty.name);
			if (options.prepare !== false) {
				yield* Effect.scoped(
					Effect.gen(function* () {
						const services = yield* Layer.build(connection(template.url, maxConnections, options));
						yield* migratePostgres(options.migrations).pipe(Effect.provideContext(services));
						if (options.fixtures !== undefined) {
							const fixtures = typeof options.fixtures === "function" ? options.fixtures(template.url) : options.fixtures;
							yield* fixtures.pipe(Effect.provideContext(services));
						}
					}),
				);
			}
			const shared = yield* database(options.url, release, template.name);
			const services = yield* Layer.build(connection(shared.url, maxConnections, options));
			const clone: PostgresTestDatabaseService["clone"] = (source) =>
				Effect.gen(function* () {
					const target = yield* database(options.url, release, source === "empty" ? empty.name : template.name);
					const context = yield* Layer.build(connection(target.url, maxConnections, options));
					return Context.add(context, PostgresTestDatabase, { awaitCleanup, clone, isolated, url: target.url });
				});
			const isolated = clone("migrated");
			return Context.add(services, PostgresTestDatabase, { awaitCleanup, clone, isolated, url: shared.url });
		}).pipe(Effect.mapError(connectionLimitHint)),
	).pipe(Layer.provide(Reactivity.layer));
}
