import { Context, Effect, Layer, Queue, Stream } from "effect";
import * as Reactivity from "effect/reactivity/Reactivity";
import { SqlClient } from "effect/sql";
import { PostgresTestDatabase } from "@shivaedev/test-sql/server/database.ts";
import { databaseUrl, postgres } from "@shivaedev/test-sql/server/emptyPostgres.ts";
import { withIsolatedDatabase } from "@shivaedev/test-sql/server/withIsolatedDatabase.ts";
import { storyKit } from "@shivaedev/test-story/server/storyKit.ts";
import { appDatabase } from "#appDatabase.ts";
import { migrationChangesLoader } from "./loader.ts";
import { runMigrationChanges } from "./run.ts";

const create = Effect.fnUntraced(function* () {
	const { url } = yield* PostgresTestDatabase;
	const table = "migration_notes";
	const context = yield* Layer.build(
		appDatabase({
			config: { changes: { channel: table }, databaseUrl: url },
			migrations: { loader: migrationChangesLoader(table, "initial"), table: `${table}_ledger` },
		}),
	);
	const sql = Context.get(context, SqlClient.SqlClient);
	const reactivity = Context.get(context, Reactivity.Reactivity);
	const rows = yield* Queue.unbounded<readonly string[]>();
	const barriers = yield* Queue.unbounded<void>();
	const deliveries = { first: 0, list: 0, second: 0 };
	const cancels = [
		...(
			[
				[table, "list"],
				[`${table}:1`, "first"],
				[`${table}:2`, "second"],
			] as const
		).map(([key, counter]) =>
			reactivity.registerUnsafe([key], () => {
				deliveries[counter] += 1;
			}),
		),
		reactivity.registerUnsafe(["migration_barrier"], () => {
			Queue.offerUnsafe(barriers, undefined);
		}),
	];
	yield* Effect.addFinalizer(() =>
		Effect.sync(() => {
			for (const cancel of cancels) {
				cancel();
			}
		}),
	);
	const read = Effect.map(sql<{ readonly title: string }>`select title from ${sql(table)} order by id`, (notes) => notes.map(({ title }) => title));
	yield* Reactivity.stream(read, [table]).pipe(
		Stream.runForEach((notes) => Queue.offer(rows, notes)),
		Effect.provideContext(context),
		Effect.forkScoped,
	);
	return { barriers, deliveries, read, rows, sql, table, url };
});

export const migrationChangesStory = storyKit({
	around: withIsolatedDatabase,
	clock: "live",
	create,
	layer: postgres,
	name: "hosted migration change delivery",
	runIf: databaseUrl !== undefined,
	stages: [],
	verbs: (state, story) => ({
		anotherProcessMigrates: (mode: "migrate" | "rollback" = "migrate") => {
			story.tell(`another process starts the database host with ${mode === "rollback" ? "a failing migration" : "repository-writing migrations"}`);
			return runMigrationChanges(state.url, state.table, mode);
		},
		currentRows: () => state.read,
		deliveries: () =>
			Effect.gen(function* () {
				yield* state.sql`select pg_notify(${state.table}, ${JSON.stringify(["migration_barrier"])})`;
				yield* Queue.take(state.barriers);
				return { ...state.deliveries };
			}),
		nextSubscriberRows: () => Queue.take(state.rows),
	}),
});
