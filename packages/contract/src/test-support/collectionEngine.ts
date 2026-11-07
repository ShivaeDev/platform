import { Context, Effect, Layer, Option, Redacted, Stream } from "effect";
import * as AtomRegistry from "effect/reactivity/AtomRegistry";
import * as AtomRpc from "effect/reactivity/AtomRpc";
import { RpcTest } from "effect/rpc";
import { Migrator, SqlClient } from "effect/sql";
import { appDatabase } from "@shivaedev/server/appDatabase.ts";
import { rerunQuery } from "@shivaedev/server/rerunQuery.ts";
import { makeRepository } from "@shivaedev/sql/repository.ts";
import { postgresTestUrl } from "@shivaedev/test-sql/server/adapters/postgresTestUrl.ts";
import { PostgresTestDatabase } from "@shivaedev/test-sql/server/database.ts";
import { makePostgresTestLayer } from "@shivaedev/test-sql/server/postgres.ts";
import { bind } from "#bind.ts";
import { changesHandlerLayer } from "#changesHandlerLayer.ts";
import { LiveServer } from "#live-server/service.ts";
import { subscribe } from "#live-server/subscribe.ts";
import { querySubscription } from "#querySubscription.ts";
import { CurrentViewer } from "#readPolicy.ts";
import { collectionContract, Guard, ManageWorkspaces, Permissions, Workspace, workspaces } from "#test/collectionContract.ts";
import { storyRuntime } from "#test/storyRuntime.ts";

const migrations = {
	loader: Migrator.fromRecord({
		"1_workspaces": Effect.gen(function* () {
			const sql = yield* SqlClient.SqlClient;
			yield* sql`create table workspaces (id integer generated always as identity primary key, tenant text not null, title text not null unique)`;
		}),
	}),
	lockTimeout: "5 seconds" as const,
};
const { url, configured } = postgresTestUrl("PLATFORM_SQL_TEST_DATABASE_URL");

export { configured };
export const collectionDatabase = makePostgresTestLayer({
	migrations,
	url: Redacted.make(url ?? "postgresql://integration-tests-disabled"),
});

export const collectionEngine = Effect.gen(function* () {
	const Workspaces = collectionContract();
	const database = yield* PostgresTestDatabase;
	const services = yield* Layer.build(appDatabase({ config: { databaseUrl: database.url }, migrations, postgresSettings: {} }));
	const repository = yield* makeRepository(Workspace, {
		collection: workspaces,
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
	const application = Workspaces.application.toLayer({
		"workspaces.all": () =>
			repository.findMany({ orderBy: { direction: "asc", field: "title" } }).pipe(
				Effect.map((rows) => rows.map((row) => new Workspace(row))),
				Effect.orDie,
			),
	});
	const handlers = Layer.merge(
		application,
		changesHandlerLayer(
			Workspaces,
			() =>
				({ queries }, options) =>
					Stream.unwrap(
						Effect.gen(function* () {
							const viewer = yield* CurrentViewer;
							const subscription = yield* querySubscription(options.rpc, queries, viewer);
							return yield* subscribe(subscription, rerunQuery(Workspaces.application, options)).pipe(Effect.provideService(LiveServer, live));
						}),
					),
		),
	).pipe(Layer.provide(application), Layer.provide(Layer.succeed(Permissions, permissions)));
	function protocol(viewer: string) {
		return Layer.merge(
			handlers,
			Layer.succeed(Guard, (effect) =>
				Effect.provideService(effect, CurrentViewer, Option.some({ id: viewer })).pipe(Effect.provideService(Permissions, permissions)),
			),
		);
	}
	const runtime = yield* storyRuntime;
	class Client extends AtomRpc.Service<Client>()("test/CollectionClient", {
		group: Workspaces,
		makeEffect: RpcTest.makeClient(Workspaces, { flatten: true }),
		protocol: protocol("admin"),
		runtime,
	}) {}
	const registry = yield* Effect.acquireRelease(
		Effect.sync(() => AtomRegistry.make()),
		(value) => Effect.sync(() => value.dispose()),
	);
	const api = bind(Workspaces, Client, { registry });
	const member = yield* RpcTest.makeClient(Workspaces, { flatten: true }).pipe(Effect.provide(protocol("member")));
	return { api, definition: Workspaces.declaration.queries[0], member, permissions, query: api.all.query(), registry, repository, services };
});
