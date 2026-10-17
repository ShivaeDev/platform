import * as PgClient from "@effect/sql-pg/PgClient";
import { Context, Effect, Layer, type Redacted } from "effect";
import * as Reactivity from "effect/reactivity/Reactivity";
import { migratePostgres, type PostgresMigrationOptions } from "@shivaedev/effect-sql/migrations.ts";
import { connection, database } from "#internal/databases.ts";
import { PostgresTestDatabase, type PostgresTestDatabaseService, type PostgresTestServices } from "./database.ts";

export interface PostgresTestOptions<E = never, R = never, TFixtures = never> {
	readonly fixtures?: Effect.Effect<unknown, E, TFixtures | PostgresTestServices>;
	readonly migrations: PostgresMigrationOptions<R>;
	readonly url: Redacted.Redacted<string>;
}

export function makePostgresTestLayer<E = never, R = never, TFixtures = never>(options: PostgresTestOptions<E, R, TFixtures>) {
	return Layer.effectContext(
		Effect.gen(function* () {
			const admin = yield* PgClient.makeClient({ url: options.url });
			const template = yield* database(admin, options.url);
			yield* Effect.scoped(
				Effect.gen(function* () {
					const services = yield* Layer.build(connection(template.url));
					yield* migratePostgres(options.migrations).pipe(Effect.provideContext(services));
					if (options.fixtures !== undefined) {
						yield* options.fixtures.pipe(Effect.provideContext(services));
					}
				}),
			);
			const shared = yield* database(admin, options.url, template.name);
			const services = yield* Layer.build(connection(shared.url));
			const isolated: PostgresTestDatabaseService["isolated"] = Effect.gen(function* () {
				const clone = yield* database(admin, options.url, template.name);
				const context = yield* Layer.build(connection(clone.url));
				return Context.add(context, PostgresTestDatabase, { isolated, url: clone.url });
			});
			return Context.add(services, PostgresTestDatabase, { isolated, url: shared.url });
		}),
	).pipe(Layer.provide(Reactivity.layer));
}
