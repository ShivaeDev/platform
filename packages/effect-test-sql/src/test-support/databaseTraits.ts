import * as PgClient from "@effect/sql-pg/PgClient";
import { Effect, Redacted, Scope } from "effect";
import { Migrator, SqlClient } from "effect/sql";
import { expect } from "vitest";
import { committingClone } from "./committingClone.ts";
import { database } from "./database.ts";
import { databasePressure } from "./databasePressure.ts";
import { limitedRole } from "./limitedRole.ts";
import { migrations } from "./migrationSteps.ts";

export function poolLimit(maxConnections: number) {
	return database.trait("configuration", `pools allow ${maxConnections} connections`, (engine) => {
		engine.options = { ...engine.options, maxConnections };
	});
}

export function roleLimit(limit = 1) {
	return database.trait("configuration", `the role allows ${limit} connections`, function* (engine) {
		engine.options = { ...engine.options, url: yield* limitedRole(limit).pipe(Effect.provideService(Scope.Scope, engine.scope)) };
	});
}

export const exhaustedRole = database.trait("configuration", "the role's only connection is occupied", function* (engine) {
	yield* PgClient.makeClient({ url: engine.options.url }).pipe(Effect.provideService(Scope.Scope, engine.scope));
});

export const markedSessions = database.trait("configuration", "database sessions have a unique application name", (engine) => {
	const url = new URL(Redacted.value(engine.options.url));
	url.searchParams.set("application_name", engine.marker);
	engine.options = { ...engine.options, url: Redacted.make(url.toString()) };
});

export const withoutFixtures = database.trait("configuration", "only migrations prepare the template", (engine) => {
	engine.options = { migrations: engine.options.migrations, url: engine.options.url };
});

export const sequence = database.trait("configuration", "the template contains a fresh sequence", (engine) => {
	engine.options = {
		migrations: {
			loader: Migrator.fromRecord({
				"1_create_sequence": Effect.gen(function* () {
					const sql = yield* SqlClient.SqlClient;
					yield* sql`create sequence test_ids`;
				}),
			}),
			lockTimeout: "5 seconds",
		},
		url: engine.options.url,
	};
});

export const failingFixtures = database.trait("configuration", "template fixtures fail after acquiring their database", (engine) => {
	engine.options = { ...engine.options, fixtures: Effect.fail("fixtures failed") };
});

export const committingClones = database.trait("activity", "two clones commit while the shared database changes", (engine) =>
	engine.run(
		Effect.gen(function* () {
			const sql = yield* SqlClient.SqlClient;
			yield* sql`update items set value = 'shared'`;
			yield* Effect.all([committingClone("a", engine.cloneNames), committingClone("b", engine.cloneNames)], { concurrency: "unbounded" });
		}),
	),
);

export const idleClock = database.trait("configuration", "pool expiry uses a controlled clock", (engine) => {
	engine.idleClock = true;
	engine.options = { ...engine.options, fixtures: Effect.void };
});

export const emptyPreparation = database.trait("configuration", "empty preparation must not load migrations or fixtures", (engine) => {
	engine.options = {
		fixtures: Effect.die("fixtures must not run on an empty schema"),
		migrations: { ...migrations, loader: Effect.die("preparation must not load migrations") },
		prepare: false,
		url: engine.options.url,
	};
});

export function databasesUnderPressure(count: number) {
	return database.trait("activity", `${count} clones reserve more connections than their pool allows`, function* (engine) {
		expect(yield* engine.admin`select count(*)::int as count from pg_stat_activity where application_name = ${engine.marker}`).toEqual([
			{ count: 0 },
		]);
		engine.pressureCount = count;
		engine.pressure = yield* engine
			.run(databasePressure(count, engine.options.maxConnections ?? 2))
			.pipe(Effect.provideService(Scope.Scope, engine.scope));
	});
}
