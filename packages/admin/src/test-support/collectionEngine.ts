import { Effect, Layer, Option, Redacted, Ref } from "effect";
import * as AtomRegistry from "effect/reactivity/AtomRegistry";
import * as AtomRpc from "effect/reactivity/AtomRpc";
import { RpcTest } from "effect/rpc";
import { Migrator, SqlClient } from "effect/sql";
import { LiveConnection } from "@shivaedev/contract/automaticLive.ts";
import { bind } from "@shivaedev/contract/bind.ts";
import { SessionPolicy } from "@shivaedev/identity/server/SessionPolicy.ts";
import type { UserSessionShape } from "@shivaedev/identity/server/session.ts";
import { appDatabase } from "@shivaedev/server/appDatabase.ts";
import { hostChanges } from "@shivaedev/server/hostChanges.ts";
import { makeRepository } from "@shivaedev/sql/repository.ts";
import { postgresTestUrl } from "@shivaedev/test-sql/server/adapters/postgresTestUrl.ts";
import { PostgresTestDatabase } from "@shivaedev/test-sql/server/database.ts";
import { makePostgresTestLayer } from "@shivaedev/test-sql/server/postgres.ts";
import { adminRegistry } from "#registry.ts";
import { registerAdmin } from "#server/registerAdmin.ts";
import { Access } from "./Access.ts";
import { collectionPage, Workspace, workspaces } from "./collectionPage.ts";

const migrations = {
	loader: Migrator.fromRecord({
		"1_admin_workspaces": Effect.gen(function* () {
			const sql = yield* SqlClient.SqlClient;
			yield* sql`create table admin_workspaces (id integer generated always as identity primary key, tenant text not null, title text not null)`;
		}),
	}),
	lockTimeout: "5 seconds" as const,
};
const { url, configured } = postgresTestUrl("PLATFORM_SQL_TEST_DATABASE_URL");

export { configured };
export const collectionDatabase = makePostgresTestLayer({ migrations, url: Redacted.make(url ?? "postgresql://integration-tests-disabled") });

export const collectionEngine = Effect.gen(function* () {
	const page = collectionPage();
	const database = yield* PostgresTestDatabase;
	const services = yield* Layer.build(appDatabase({ config: { databaseUrl: database.url }, migrations }));
	const repository = yield* makeRepository(Workspace, {
		collection: workspaces,
		idColumn: "id",
		spanPrefix: "AdminWorkspaces",
		tableName: "admin_workspaces",
	}).pipe(Effect.provideContext(services));
	const session = yield* Ref.make<Option.Option<UserSessionShape>>(Option.none());
	const registration = registerAdmin(adminRegistry(page), {
		workspaces: page.contract.application.toLayer({
			"admin.workspaces.all": () => repository.findMany({ orderBy: { direction: "asc", field: "id" } }).pipe(Effect.orDie),
		}),
	});
	const policy = { origin: () => true, provider: { get: () => Ref.get(session) }, roles: Access };
	const protocol = Layer.merge(registration.handlers, hostChanges(registration.group)).pipe(
		Layer.provide(Layer.succeed(SessionPolicy, policy)),
		Layer.provide(Layer.succeedContext(services)),
	);
	class Client extends AtomRpc.Service<Client>()("test/AdminCollectionClient", {
		group: registration.group,
		makeEffect: RpcTest.makeClient(registration.group, { flatten: true }),
		protocol,
	}) {}
	const registry = yield* Effect.acquireRelease(
		Effect.sync(() => AtomRegistry.make()),
		(value) => Effect.sync(() => value.dispose()),
	);
	const api = bind(page.contract, Client, { registry });
	registry.set(api[LiveConnection].coalesceWindow, 0);
	const query = api.all.query();
	const before: { current?: unknown } = {};
	return { api, before, query, registry, repository, services, session };
});
