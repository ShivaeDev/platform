import { Deferred, Effect, Redacted } from "effect";
import { SqlClient } from "effect/sql";
import { PgBoss } from "pg-boss";
import { storyKit } from "@shivaedev/test-story/server/storyKit.ts";
import { PostgresTestDatabase } from "#database.ts";
import { withIsolatedDatabase } from "#withIsolatedDatabase.ts";
import { setup } from "./postgres.ts";

const closed: string[] = [];
let previousClosed: readonly string[] = [];

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
		const jobs = yield* Effect.acquireRelease(
			Effect.promise(async () => {
				const client = new PgBoss({ connectionString: Redacted.value(database.url) });
				await client.start();
				return client;
			}),
			(client) => Effect.promise(() => client.stop()),
		);
		yield* Effect.promise(async () => {
			await jobs.createQueue("write-item");
			await jobs.work<{ value: string }>("write-item", { pollingIntervalSeconds: 0.5 }, async ([job]) => {
				if (job === undefined) {
					throw new Error("The worker received an empty batch.");
				}
				await Effect.runPromise(Effect.andThen(sql`insert into items values (2, ${job.data.value})`, Deferred.succeed(written, undefined)));
			});
		});
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
			yield* Effect.promise(() => engine.jobs.send("write-item", { value }));
			yield* Deferred.await(engine.written);
			story.tell(`the worker stored ${value}`);
		}),
	}),
});
