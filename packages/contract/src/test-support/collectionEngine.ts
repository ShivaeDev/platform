import { Config, Context, Effect, Layer, Option, Redacted, Schema, Stream } from "effect";
import * as AtomRegistry from "effect/reactivity/AtomRegistry";
import * as AtomRpc from "effect/reactivity/AtomRpc";
import { RpcTest } from "effect/rpc";
import { Migrator, SqlClient } from "effect/sql";
import { appDatabase } from "@shivaedev/server/appDatabase.ts";
import { makeRepository } from "@shivaedev/sql/repository.ts";
import { PostgresTestDatabase } from "@shivaedev/test-sql/server/database.ts";
import { makePostgresTestLayer } from "@shivaedev/test-sql/server/postgres.ts";
import { LiveConnection } from "#automaticLive.ts";
import { bind } from "#bind.ts";
import { changesSuccess } from "#internal/changesSuccess.ts";
import { LiveServer } from "#LiveServer.ts";
import { querySubscription } from "#querySubscription.ts";
import { authorizeReads, CurrentViewer } from "#readPolicy.ts";
import { Guard, ManageWorkspaces, Permissions, Workspace, Workspaces } from "./collectionContract.ts";

const migrations = {
	loader: Migrator.fromRecord({
		"1_workspaces": Effect.gen(function* () {
			const sql = yield* SqlClient.SqlClient;
			yield* sql`create table workspaces (id integer generated always as identity primary key, tenant text not null, title text not null unique)`;
		}),
	}),
	lockTimeout: "5 seconds" as const,
};
const url = Effect.runSync(Config.String("PLATFORM_SQL_TEST_DATABASE_URL").pipe(Config.option));
export const configured = Option.isSome(url);
export const collectionDatabase = makePostgresTestLayer({
	migrations,
	url: Redacted.make(Option.getOrElse(url, () => "postgresql://integration-tests-disabled")),
});

export const collectionEngine = Effect.gen(function* () {
	const database = yield* PostgresTestDatabase;
	const services = yield* Layer.build(appDatabase({ config: { databaseUrl: database.url }, migrations }));
	const repository = yield* makeRepository(Workspace, {
		conflictColumns: ["title"],
		idColumn: "id",
		spanPrefix: "CollectionWorkspaces",
		tableName: "workspaces",
	}).pipe(Effect.provideContext(services));
	const permissions = new Map([
		["admin", { email: "admin@example.test", id: "admin", name: "Admin", permissions: [ManageWorkspaces] }],
		["member", { email: "member@example.test", id: "member", name: "Member", permissions: [] }],
	]);
	const live = Context.get(services, LiveServer);
	const handlers = Workspaces.toLayer({
		"workspaces.$changes": ({ queries }, { rpc }) =>
			Stream.unwrap(
				Effect.gen(function* () {
					const subscription = yield* querySubscription(rpc, queries, yield* CurrentViewer);
					const stream = yield* live.subscribe(subscription);
					return stream.pipe(
						Stream.mapEffect((update) => Schema.decodeUnknownEffect(changesSuccess(Workspaces.declaration.queries))(update).pipe(Effect.orDie)),
					);
				}),
			),
		"workspaces.all": () => repository.findMany({ orderBy: { direction: "asc", field: "title" } }).pipe(Effect.orDie),
	}).pipe(Layer.provide(Layer.succeed(Permissions, permissions)));
	function protocol(viewer: string) {
		return Layer.merge(
			handlers,
			Layer.succeed(Guard, (effect, request) =>
				authorizeReads(effect, request, Option.some({ id: viewer })).pipe(Effect.provideService(Permissions, permissions)),
			),
		);
	}
	class Client extends AtomRpc.Service<Client>()("test/CollectionClient", {
		group: Workspaces,
		makeEffect: RpcTest.makeClient(Workspaces, { flatten: true }),
		protocol: protocol("admin"),
	}) {}
	const registry = yield* Effect.acquireRelease(
		Effect.sync(() => AtomRegistry.make()),
		(value) => Effect.sync(() => value.dispose()),
	);
	const api = bind(Workspaces, Client);
	registry.set(api[LiveConnection].coalesceWindow, 0);
	const member = yield* RpcTest.makeClient(Workspaces, { flatten: true }).pipe(Effect.provide(protocol("member")));
	return { api, member, permissions, query: api.all.query(), registry, repository, services };
});
