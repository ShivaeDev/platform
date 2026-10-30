import { Context, Deferred, Effect, Layer, Redacted, Schema } from "effect";
import { SqlClient } from "effect/sql";
import { defineQueue } from "@shivaedev/jobs/server/definition.ts";
import { makePgBoss } from "@shivaedev/jobs/server/service.ts";
import { storyKit } from "@shivaedev/test-story/server/storyKit.ts";
import { PostgresTestDatabase } from "#database.ts";
import { withIsolatedDatabase } from "#withIsolatedDatabase.ts";
import { setup } from "./postgres.ts";

const closed: string[] = [];
let previousClosed: readonly string[] = [];
const Jobs = makePgBoss("@test/TimeoutAppJobs");
const writeItem = defineQueue({
	name: "write-item",
	schema: Schema.Struct({ value: Schema.String }),
	worker: { pollingIntervalSeconds: 0.5 },
});

export const timeoutApp = storyKit({
	around: (effect) =>
		Effect.suspend(() => {
			previousClosed = [...closed];
			return withIsolatedDatabase(effect);
		}),
	clock: "live",
	*create() {
		const closedBeforeSetup = previousClosed;
		const sql = yield* SqlClient.SqlClient;
		const database = yield* PostgresTestDatabase;
		const name = new URL(Redacted.value(database.url)).pathname;
		yield* Effect.addFinalizer(() => Effect.sync(() => closed.push(name)));
		const written = yield* Deferred.make<void>();
		const services = yield* Layer.build(
			Jobs.layer({
				connectionString: Redacted.value(database.url),
				jobs: [writeItem.handle(({ value }) => Effect.andThen(sql`insert into items values (2, ${value})`, Deferred.succeed(written, undefined)))],
			}),
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
		closedBeforeSetup: () => engine.closedBeforeSetup,
		database: () => engine.name,
		hang: () => {
			story.tell("the application waits on nothing past its timeout");
			return Effect.never;
		},
		items: () => Effect.map(engine.sql<{ value: string }>`select value from items order by id`, (rows) => rows.map(({ value }) => value)),
		writeItem: Effect.fn("TimeoutApp.writeItem")(function* (value: string) {
			yield* engine.jobs.enqueue(writeItem, { value });
			yield* Deferred.await(engine.written);
			story.tell(`the worker stored ${value}`);
		}),
	}),
});
