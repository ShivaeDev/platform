import { Config, Effect, Layer, Option, Ref, Stream } from "effect";
import * as AtomRegistry from "effect/reactivity/AtomRegistry";
import * as Reactivity from "effect/reactivity/Reactivity";
import { RpcClient } from "effect/rpc";
import { Migrator, SqlClient } from "effect/sql";
import { invalidationKeys } from "@shivaedev/changes/keys.ts";
import { makePostgresTestLayer } from "@shivaedev/test-sql/server/postgres.ts";
import { makeClient } from "#bind.ts";
import { makeLiveServer } from "#makeLiveServer.ts";
import { queryKeys } from "#queryKeys.ts";
import { querySubscription } from "#querySubscription.ts";
import { authorizeReads } from "#readPolicy.ts";
import { layerMemoryProtocol } from "#testing.ts";
import { Guard, records, TimelineData, Timelines, Unavailable } from "./derivedReadsContract.ts";

export const derivedDatabase = Layer.unwrap(
	Effect.map(Config.Redacted("PLATFORM_SQL_TEST_DATABASE_URL"), (url) =>
		makePostgresTestLayer({
			migrations: {
				loader: Migrator.fromRecord({
					"1_timelines": Effect.gen(function* () {
						const sql = yield* SqlClient.SqlClient;
						yield* sql`create table lists (id integer primary key, scope text not null)`;
						yield* sql`create table records (id integer primary key, list_id integer not null references lists, body text not null)`;
						yield* sql`insert into lists values (1, 'alice'), (2, 'alice'), (3, 'bob')`;
						yield* sql`insert into records values (1, 1, 'First'), (2, 2, 'Second'), (3, 3, 'Private')`;
					}),
				}),
				lockTimeout: "5 seconds",
			},
			url,
		}),
	),
);

export const derivedReadsEngine = Effect.gen(function* () {
	const sql = yield* SqlClient.SqlClient;
	const reactivity = yield* Reactivity.make;
	const live = yield* makeLiveServer.pipe(Effect.provideService(Reactivity.Reactivity, reactivity));
	const projectKeys = yield* Ref.make(false);
	const viewer = Option.some({ id: "alice" });
	const data = Layer.succeed(TimelineData, {
		keys: (scope) =>
			sql<{ id: number }>`select id from lists where scope = ${scope}`.pipe(
				Effect.map((rows) => [...rows.map(({ id }) => records.bucket.listId(id)), records.bucket.scope(scope)]),
				Effect.catchTag("SqlError", () => Effect.fail(new Unavailable())),
			),
		load: (scope) =>
			sql<{ body: string }>`select r.body from records r join lists l on r.list_id = l.id where l.scope = ${scope} order by r.id`.pipe(
				Effect.map((rows) => rows.map(({ body }) => body)),
				Effect.catchTag("SqlError", () => Effect.fail(new Unavailable())),
			),
	});
	const create = Effect.fnUntraced(function* ({ id, scope, body }: { id: number; scope: string; body: string }) {
		yield* sql
			.withTransaction(
				Effect.gen(function* () {
					yield* sql`insert into lists values (${id}, ${scope})`;
					yield* sql`insert into records values (${id}, ${id}, ${body})`;
				}),
			)
			.pipe(Effect.catchTag("SqlError", () => Effect.fail(new Unavailable())));
		yield* reactivity.invalidate(invalidationKeys([records.bucket.scope(scope)]));
	});
	const edit = Effect.fnUntraced(function* ({ id, body }: { id: number; body: string }) {
		const rows = yield* sql
			.withTransaction(
				sql<{
					"list_id": number;
					scope: string;
				}>`update records set body = ${body} where id = ${id} returning list_id, (select scope from lists where lists.id = records.list_id) as scope`,
			)
			.pipe(Effect.catchTag("SqlError", () => Effect.fail(new Unavailable())));
		const row = rows[0];
		if (row === undefined) {
			return yield* new Unavailable();
		}
		yield* reactivity.invalidate(invalidationKeys([records.item(id), records.bucket.listId(row.list_id), records.bucket.scope(row.scope)]));
		return row.list_id;
	});
	const handlers = Timelines.application
		.toLayer({
			"timelines.create": create,
			"timelines.edit": edit,
			"timelines.timeline": ({ scope }) => Effect.flatMap(TimelineData, (current) => current.load(scope)),
		})
		.pipe(Layer.provide(data));
	const changes = Timelines.omit("timelines.timeline", "timelines.edit", "timelines.create")
		.toLayer({
			"timelines.$changes": ({ queries }, { rpc }) =>
				Stream.unwrap(
					Effect.gen(function* () {
						if (yield* Ref.get(projectKeys)) {
							return live.stream(yield* queryKeys(Timelines.declaration.queries, queries, viewer));
						}
						return live.subscribe(yield* querySubscription(rpc, queries, viewer));
					}),
				),
		})
		.pipe(Layer.provide(data));
	const protocol = layerMemoryProtocol(Timelines).pipe(
		Layer.provide([handlers, changes, Layer.succeed(Guard, (effect, request) => authorizeReads(effect, request, viewer))]),
	);
	const transport = yield* Layer.build(protocol);
	const registry = yield* Effect.acquireRelease(
		Effect.sync(() => AtomRegistry.make()),
		(value) => Effect.sync(() => value.dispose()),
	);
	const connection = makeClient(Timelines, { protocol: Layer.succeedContext(transport), url: "memory://timelines" });
	const client = yield* RpcClient.make(Timelines, { flatten: true }).pipe(Effect.provideContext(transport));
	const query = connection.api.timeline.query({ scope: "alice" });
	return { client, projectKeys, query, registry, sql };
});
