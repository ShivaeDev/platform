import * as PgClient from "@effect/sql-pg/PgClient";
import { Context, Effect, Layer, Redacted } from "effect";
import { RpcTest } from "effect/rpc";
import { Migrator, SqlClient } from "effect/sql";
import { BeforeCommit, ChangeObserver } from "@shivaedev/sql/transact.ts";
import { postgresTestUrl } from "@shivaedev/test-sql/server/adapters/postgresTestUrl.ts";
import { PostgresTestDatabase } from "@shivaedev/test-sql/server/database.ts";
import { makePostgresTestLayer } from "@shivaedev/test-sql/server/postgres.ts";
import { withIsolatedDatabase } from "@shivaedev/test-sql/server/withIsolatedDatabase.ts";
import { storyKit } from "@shivaedev/test-story/server/storyKit.ts";
import { requestTracingLayer } from "#server/tracing.ts";
import { recorder } from "#test/rpc/harness.ts";
import { host } from "./host.ts";
import { viewerFixture } from "./viewerFixture.ts";

const { url } = postgresTestUrl("PLATFORM_SQL_TEST_DATABASE_URL");
const postgres = makePostgresTestLayer({
	fixtures: Effect.flatMap(
		SqlClient.SqlClient,
		(sql) => sql`create table command_notes (id integer generated always as identity primary key, title text not null)`,
	),
	migrations: { loader: Migrator.fromRecord({}), lockTimeout: "5 seconds" },
	url: Redacted.make(url ?? "postgresql://integration-tests-disabled"),
});

export const commandChanges = storyKit({
	around: withIsolatedDatabase,
	clock: "live",
	*create() {
		const database = yield* PostgresTestDatabase;
		const writer = yield* PgClient.make({ maxConnections: 4, url: database.url });
		const reader = yield* PgClient.make({ maxConnections: 4, url: database.url });
		const channel = `commands_${crypto.randomUUID().replaceAll("-", "")}`;
		const state: { attempts: Array<readonly { title: string }[]>; broadcastFails: boolean; failures: number } = {
			attempts: [],
			broadcastFails: false,
			failures: 0,
		};
		const local = yield* host(writer, channel, state);
		const remote = yield* host(reader, channel, { broadcastFails: false });
		const notify = Context.get(local.services, BeforeCommit);
		const services = Context.add(local.services, BeforeCommit, (keys) =>
			Effect.gen(function* () {
				state.attempts.push(yield* reader<{ title: string }>`select title from command_notes order by id`);
				if (state.failures !== 0) {
					state.failures -= 1;
					yield* writer`select 1 / 0`;
				}
				yield* notify(keys);
			}),
		);
		const recorded = recorder();
		const fixture = viewerFixture();
		const publications: Array<readonly unknown[]> = [];
		const observer = yield* ChangeObserver;
		const observed = Context.add(services, ChangeObserver, (event) =>
			Effect.gen(function* () {
				if (event._tag === "Published") {
					publications.push(event.changes);
				}
				yield* observer(event);
			}),
		);
		const application = yield* Layer.build(
			fixture.application.pipe(
				Layer.provideMerge(requestTracingLayer()),
				Layer.provideMerge(recorded.layer),
				Layer.provide(Layer.succeedContext(observed)),
			),
		);
		const client = yield* RpcTest.makeClient(fixture.api).pipe(Effect.provide(application));
		return { client, local, logs: recorded.logs, publications, remote, services: observed, state, viewers: fixture.viewers };
	},
	inspect: (engine) => ({ publicationAttempts: engine.state.attempts, publications: engine.publications, viewers: engine.viewers }),
	layer: postgres,
	name: "command changes",
	runIf: url !== undefined,
	stages: ["publication"],
	verbs: (engine, story) => ({
		errorMessages: () =>
			Effect.sync(() => engine.logs.filter((log) => log.level === "Error").map((log) => (Array.isArray(log.message) ? log.message[0] : log.message))),
		initialHint: (location: "local" | "remote") => Effect.succeed(engine[location].initial),
		invalidationViewers: () => Effect.sync(() => engine.viewers),
		nextHint: (location: "local" | "remote") => engine[location].next,
		publicationSaw: () => Effect.sync(() => engine.state.attempts),
		publishedChanges: () => Effect.sync(() => engine.publications),
		read: () => engine.client["notes.list"](undefined).pipe(Effect.provide(engine.services)),
		save: (title: string) => {
			story.tell(`save the note "${title}" through the command`);
			return engine.client["notes.save"]({ title }).pipe(Effect.provide(engine.services));
		},
		saveAs: (auth: "required" | "optional" | "user" | "accounts", caller: "alice" | "anonymous" = "alice") => {
			story.tell(`${caller} saves a note through the ${auth}-auth command with a pre-resolved session`);
			return engine.client[`${auth}.save`](
				{ title: "Alice's note" },
				{
					headers: caller === "anonymous" ? {} : { authorization: caller },
				},
			).pipe(Effect.provide(engine.services));
		},
	}),
});

export function publicationFails(times: number | "always") {
	return commandChanges.trait(
		"publication",
		`declared-key publication fails ${times === "always" ? "on every attempt" : `${times} times`} in PostgreSQL`,
		(engine) => {
			engine.state.failures = times === "always" ? -1 : times;
		},
	);
}

export const broadcastFails = commandChanges.trait(
	"publication",
	"PostgreSQL also rejects the Resync broadcast while both listeners remain healthy",
	(engine) => {
		engine.state.broadcastFails = true;
	},
);
