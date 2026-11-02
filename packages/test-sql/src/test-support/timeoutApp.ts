import { Context, Deferred, Effect, Layer, Redacted, Schema } from "effect";
import { SqlClient } from "effect/sql";
import { defineQueue } from "@shivaedev/jobs/server/definition.ts";
import { makePgBoss, pgBossLayer } from "@shivaedev/jobs/server/service.ts";
import { storyKit } from "@shivaedev/test-story/server/storyKit.ts";
import { PostgresTestDatabase } from "#database.ts";
import { withIsolatedDatabase } from "#withIsolatedDatabase.ts";
import { setup } from "./postgres.ts";

export interface CloneObservation {
	readonly database: string;
	readonly sessions: number;
	readonly state: "exists" | "dropped";
}

let previousDatabase: string | undefined;
let beforeSetup: CloneObservation | undefined;
const Jobs = makePgBoss("@test/TimeoutAppJobs");
const writeItem = defineQueue({
	name: "write-item",
	schema: Schema.Struct({ value: Schema.String }),
	worker: { pollingIntervalSeconds: 0.5 },
});

export const timeoutApp = storyKit({
	around: (effect) =>
		Effect.gen(function* () {
			if (previousDatabase !== undefined) {
				const database = yield* PostgresTestDatabase;
				yield* database.awaitCleanup;
				const sql = yield* SqlClient.SqlClient;
				const rows = yield* sql`select 1 from pg_database where datname = ${previousDatabase}`;
				const [activity] = yield* sql<{
					sessions: number;
				}>`select count(*)::int as sessions from pg_stat_activity where datname = ${previousDatabase}`;
				beforeSetup = { database: previousDatabase, sessions: activity?.sessions ?? 0, state: rows.length > 0 ? "exists" : "dropped" };
			}
			return yield* withIsolatedDatabase(effect);
		}),
	clock: "live",
	*create() {
		const closedBeforeSetup = beforeSetup;
		const sql = yield* SqlClient.SqlClient;
		const database = yield* PostgresTestDatabase;
		const name = new URL(Redacted.value(database.url)).pathname.slice(1);
		previousDatabase = name;
		const written = yield* Deferred.make<void>();
		const services = yield* Layer.build(
			Jobs.layer({
				jobs: [writeItem.handle(({ value }) => Effect.andThen(sql`insert into items values (2, ${value})`, Deferred.succeed(written, undefined)))],
			}).pipe(Layer.provide(pgBossLayer({ connectionString: database.url }))),
		);
		const jobs = Context.get(services, Jobs);
		yield* Effect.addFinalizer(() => sql`insert into notes values (1, 'closed')`.pipe(Effect.orDie));
		return { closedBeforeSetup, jobs, name, sql, written };
	},
	inspect: (engine) => ({ closedBeforeSetup: engine.closedBeforeSetup, name: engine.name }),
	layer: setup().layer,
	name: "timeout app",
	stages: [],
	verbs: (engine, story) => ({
		closedBeforeSetup: () => {
			story.tell("the story reads the previous clone’s PostgreSQL state before setup");
			return engine.closedBeforeSetup;
		},
		database: () => {
			story.tell("the story reads its clone’s database name");
			return engine.name;
		},
		hang: () => {
			story.tell("the application waits on nothing past its timeout");
			return Effect.never;
		},
		items: () => {
			story.tell("the story reads the items written by its job worker");
			return Effect.map(engine.sql<{ value: string }>`select value from items order by id`, (rows) => rows.map(({ value }) => value));
		},
		writeItem: Effect.fn("TimeoutApp.writeItem")(function* (value: string) {
			story.tell(`the application enqueues the item "${value}" and waits for its worker to write it`);
			yield* engine.jobs.enqueue(writeItem, { value });
			yield* Deferred.await(engine.written);
		}),
	}),
});
