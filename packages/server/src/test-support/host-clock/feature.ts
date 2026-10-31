import { Clock, Effect, Layer, Schema } from "effect";
import { Migrator, SqlClient } from "effect/sql";
import { collection, invalidationKeys } from "@shivaedev/changes/keys.ts";
import { contract } from "@shivaedev/contract/contract.ts";
import { command, query } from "@shivaedev/contract/operation.ts";
import { defineQueue } from "@shivaedev/jobs/server/definition.ts";
import { makePgBoss, pgBossLayer } from "@shivaedev/jobs/server/service.ts";
import type { PgBossTesting } from "@shivaedev/jobs/server/testing.ts";
import { invalidateOnCommit, transact } from "@shivaedev/sql/transact.ts";
import { PostgresTestDatabase } from "@shivaedev/test-sql/server/database.ts";
import { appHost } from "#appHost.ts";

const notes = collection("clock-notes", Schema.Number);
const Jobs = makePgBoss("test/HostClockJobs");
const Write = defineQueue({ name: "write-note", schema: Schema.Struct({ title: Schema.String }) });
export const Api = contract("clock", {
	commands: [command("write", { invalidates: () => [], payload: { title: Schema.String } })],
	queries: [
		query("read", {
			readPolicy: () => Effect.succeed(true),
			reads: () => [notes.list],
			success: Schema.Struct({ notes: Schema.Array(Schema.Struct({ title: Schema.String, writtenAt: Schema.Number })), now: Schema.Number }),
		}),
	],
});

export const openHost = Effect.fnUntraced(function* (testing: PgBossTesting) {
	const database = yield* PostgresTestDatabase;
	const services = Jobs.layer({
		jobs: [
			Write.handle(({ title }) =>
				Effect.gen(function* () {
					const writtenAt = yield* Clock.currentTimeMillis;
					yield* SqlClient.SqlClient.use((sql) => sql`insert into notes (title, written_at) values (${title}, ${writtenAt})`);
				}).pipe(Effect.andThen(invalidateOnCommit(invalidationKeys([notes.list]))), transact({ onSqlError: (error) => error })),
			),
		],
	}).pipe(Layer.provide(pgBossLayer({ clientFactory: testing.clientFactory, connectionString: database.url, supervise: false })));
	return yield* Layer.build(
		appHost({
			config: { databaseUrl: database.url, disablePreemptiveShutdown: true, host: "127.0.0.1", port: 0 },
			group: Api,
			handlers: Api.application.toLayer({
				"clock.read": () =>
					Effect.gen(function* () {
						const rows = yield* SqlClient.SqlClient.use(
							(sql) => sql<{ title: string; writtenAt: number }>`select title, written_at as "writtenAt" from notes order by id`,
						).pipe(Effect.orDie);
						return { notes: rows, now: yield* Clock.currentTimeMillis };
					}),
				"clock.write": ({ title }) => Jobs.use((jobs) => jobs.enqueue(Write, { title })).pipe(Effect.orDie, Effect.asVoid),
			}),
			migrations: {
				loader: Migrator.fromRecord({
					"001_notes": SqlClient.SqlClient.use(
						(sql) => sql`create table notes (id serial primary key, title text not null, written_at double precision not null)`,
					),
				}),
			},
			policy: "loopback",
			services,
		}),
	);
});
