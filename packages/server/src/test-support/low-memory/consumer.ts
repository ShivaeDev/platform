import { Context, Effect, Layer, type Redacted, Schema, Stream } from "effect";
import { Migrator, SqlClient } from "effect/sql";
import { collection } from "@shivaedev/changes/keys.ts";
import { LiveServer } from "@shivaedev/contract/LiveServer.ts";
import { invalidateOnCommit, transact } from "@shivaedev/sql/transact.ts";
import { appDatabase } from "#appDatabase.ts";
import { followHints } from "#test/rpc/followHints.ts";

const payloads = collection("payloads", Schema.Number);

export const startConsumer = Effect.fnUntraced(function* (url: Redacted.Redacted<string>) {
	const context = yield* Layer.build(
		appDatabase({
			config: { databaseUrl: url, maxConnections: 3 },
			migrations: {
				loader: Migrator.fromRecord({
					"001_payloads": SqlClient.SqlClient.use((migration) => migration`create table payloads (id integer, value text storage external)`),
				}),
			},
		}),
	);
	const sql = Context.get(context, SqlClient.SqlClient);
	const feed = yield* followHints(Stream.unwrap(Context.get(context, LiveServer).stream([payloads.list])));
	return {
		feed,
		publishChange: () =>
			sql`insert into payloads values (0, 'after trim')`.pipe(
				Effect.andThen(invalidateOnCommit(["payloads"])),
				transact({ onSqlError: (error) => error }),
				Effect.provideContext(context),
			),
		storedPayloads: () =>
			sql`select count(*)::integer as count, sum(length(value))::integer as bytes, bool_and(value = repeat(md5(id::text), 128)) as intact from payloads`,
		warmData: () =>
			Effect.gen(function* () {
				yield* sql`insert into payloads select id, repeat(md5(id::text), 128) from generate_series(1, 32768) id`;
				yield* sql`checkpoint`;
				yield* sql`select sum(length(value)) from payloads`;
			}),
	};
});

export type Consumer = Effect.Success<ReturnType<typeof startConsumer>>;
