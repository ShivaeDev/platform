import { Effect, Layer, Option } from "effect";
import { SqlClient } from "effect/sql";
import { defineService } from "@shivaedev/service/defineService.ts";
import { transact } from "@shivaedev/sql/transact.ts";
import type { Story } from "@shivaedev/test-story/server/storyKit.ts";
import { PostgresTestDatabase } from "#database.ts";
import { observeUntil } from "#observeUntil.ts";
import type { DatabaseEngine } from "./databaseEngine.ts";
import { databaseQueries } from "./databaseQueries.ts";
import { inPlace } from "./inPlace.ts";

export type Ending = "succeeds" | "fails with rejected" | "dies with assertion failed";

const endings: Record<Ending, Effect.Effect<void, string>> = {
	"dies with assertion failed": Effect.die(new Error("assertion failed")),
	"fails with rejected": Effect.fail("rejected"),
	succeeds: Effect.void,
};

export function writeItem(value: string) {
	return Effect.flatMap(SqlClient.SqlClient, (sql) => sql`update items set value = ${value}`);
}

const Items = defineService({
	id: "@test/Items",
	initialize: Effect.void,
	methods: () => ({ rename: (value: string) => Effect.asVoid(writeItem(value)) }),
	requires: [SqlClient.SqlClient],
});

export function databaseVerbs(engine: DatabaseEngine, story: Story<DatabaseEngine>) {
	const admin = engine.admin;
	const awaitCleanup = engine.run(Effect.flatMap(PostgresTestDatabase, (database) => database.awaitCleanup));
	function roleOf(name: string) {
		if (name === engine.shared) {
			return "the shared database";
		}
		return name === engine.template ? "the migrated template" : "the empty template";
	}
	function exists(name: string) {
		return Effect.map(admin`select 1 from pg_database where datname = ${name}`, (rows) => (rows.length > 0 ? "exists" : "dropped"));
	}
	return {
		...databaseQueries(engine, story),
		adminSessions: () => {
			story.tell("the story waits for the worker’s administration sessions to close");
			const sessions = admin<{ count: number }>`select count(*)::int as count from pg_stat_activity
				where application_name = ${engine.marker} and datname = current_database()`.pipe(Effect.map(([row]) => row?.count ?? 0));
			return observeUntil(sessions, (count) => count === 0, "the worker's administration sessions to close").pipe(
				Effect.as("none open"),
				Effect.catchTag("NeverSettled", (error) => Effect.succeed(`${Option.getOrElse(error.last, () => "unknown")} open`)),
			);
		},
		blockOutcome: (block: string) => {
			story.tell(`the story reads how ${block} ended`);
			return Effect.sync(() => engine.endings.get(block) ?? "still running");
		},
		buildItemsServiceAndRename: (value: string, place: string) => {
			story.tell(`an application Layer built in ${place} renames the item to "${value}"`);
			return inPlace(engine, place, Effect.flatMap(Items, (service) => service.rename(value)).pipe(Effect.provide(Layer.fresh(Items.layer))));
		},
		cloneDatabase: (block: string) => {
			story.tell(`the story awaits cleanup and checks whether ${block}’s clone exists`);
			return Effect.gen(function* () {
				yield* awaitCleanup;
				return yield* exists((yield* engine.block(block)).database);
			});
		},
		closeWorker: () => {
			story.tell("the worker closes its PostgreSQL test Layer");
			return engine.close();
		},
		databasesDuringPreparation: () => {
			story.tell("the story reads which databases were present during preparation");
			return Effect.sync(() => engine.ownDatabases.map(roleOf).sort());
		},
		end: (block: string, ending: Ending) => {
			story.tell(`${block} ${ending}`);
			return engine.end(block, endings[ending]);
		},
		finalizerQuery: () => {
			story.tell("the story reads the finalizer query outcome");
			return Effect.sync(() => engine.finalizerQuery);
		},
		interrupt: (block: string) => {
			story.tell(`${block} is interrupted`);
			return engine.interrupt(block);
		},
		nestedTransactionFails: (value: string, place: string) => {
			story.tell(`a nested transaction in ${place} writes "${value}" and fails`);
			return inPlace(engine, place, transact(Effect.andThen(writeItem(value), Effect.fail("rejected")), { onSqlError: (error) => error })).pipe(
				Effect.ignore,
			);
		},
		openIsolatedBlock: (name: string) => {
			story.tell(`${name} opens its clone`);
			return engine.open(name, "isolated block");
		},
		preparationRuns: () => {
			story.tell("the story reads how often migrations and fixtures ran");
			return Effect.sync(() => ({ ...engine.fixture.counts }));
		},
		publishedInvalidations: () => {
			story.tell("the story reads the published invalidations");
			return Effect.sync(() => [...engine.published]);
		},
		workerDatabases: () => {
			story.tell("the story checks which worker databases remain");
			return Effect.gen(function* () {
				const remaining = new Set(yield* engine.databaseNames());
				return engine.ownDatabases
					.filter((name) => remaining.has(name))
					.map(roleOf)
					.sort();
			});
		},
		workerStart: () => {
			story.tell("the story reads the worker startup outcome");
			return Effect.sync(() => engine.start);
		},
		writeItem: (value: string, place: string) => {
			story.tell(`${place} writes the item "${value}"`);
			return inPlace(engine, place, writeItem(value));
		},
		writeNote: (value: string, place: string) => {
			story.tell(`${place} writes the note "${value}"`);
			return inPlace(
				engine,
				place,
				Effect.flatMap(SqlClient.SqlClient, (sql) => sql`insert into notes values (1, ${value})`),
			);
		},
	};
}
