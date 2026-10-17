import { Context, Effect, Layer, type Redacted } from "effect";
import * as Reactivity from "effect/reactivity/Reactivity";
import { migratePostgres, type PostgresMigrationOptions } from "@shivaedev/effect-sql/migrations.ts";
import { PostgresTestDatabase, type PostgresTestDatabaseService, type PostgresTestServices } from "#database.ts";
import { connectionLimitHint } from "#internal/connectionLimitHint.ts";
import { connection, database } from "#internal/databases.ts";

export interface PostgresTestOptions<E = never, R = never, TFixtures = never> {
	readonly fixtures?: Effect.Effect<unknown, E, TFixtures | PostgresTestServices>;
	readonly maxConnections?: number;
	readonly migrations: PostgresMigrationOptions<R>;
	readonly prepare?: boolean;
	readonly url: Redacted.Redacted<string>;
}

export function makePostgresTestLayer<E = never, R = never, TFixtures = never>(options: PostgresTestOptions<E, R, TFixtures>) {
	return Layer.effectContext(
		Effect.gen(function* () {
			const maxConnections = options.maxConnections ?? 2;
			const template = yield* database(options.url);
			if (options.prepare !== false) {
				yield* Effect.scoped(
					Effect.gen(function* () {
						const services = yield* Layer.build(connection(template.url, maxConnections));
						yield* migratePostgres(options.migrations).pipe(Effect.provideContext(services));
						if (options.fixtures !== undefined) {
							yield* options.fixtures.pipe(Effect.provideContext(services));
						}
					}),
				);
			}
			const shared = yield* database(options.url, template.name);
			const services = yield* Layer.build(connection(shared.url, maxConnections));
			const isolated: PostgresTestDatabaseService["isolated"] = Effect.gen(function* () {
				const clone = yield* database(options.url, template.name);
				const context = yield* Layer.build(connection(clone.url, maxConnections));
				return Context.add(context, PostgresTestDatabase, { isolated, url: clone.url });
			});
			return Context.add(services, PostgresTestDatabase, { isolated, url: shared.url });
		}).pipe(Effect.mapError(connectionLimitHint)),
	).pipe(Layer.provide(Reactivity.layer));
}
