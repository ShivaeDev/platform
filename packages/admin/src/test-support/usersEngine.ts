import { Effect, Layer, Logger, Option, References, Schema } from "effect";
import * as Reactivity from "effect/reactivity/Reactivity";
import { RpcTest } from "effect/rpc";
import { SqlClient } from "effect/sql";
import { makeLiveServer } from "@shivaedev/contract/makeLiveServer.ts";
import { AuthUnavailable } from "@shivaedev/errors/taxonomy.ts";
import { authDatabase, betterAuthMount } from "@shivaedev/identity/server/better-auth/mount.ts";
import { permissionLayer } from "@shivaedev/identity/server/permissions.ts";
import { AppChanges } from "@shivaedev/server/appHost.ts";
import { hostChanges } from "@shivaedev/server/hostChanges.ts";
import { PostgresTestDatabase } from "@shivaedev/test-sql/server/database.ts";
import { UsersPermission } from "#permissions.ts";
import { usersHandlers } from "#server/usersHandlers.ts";
import { usersPage } from "#users/page.ts";
import { Access } from "./Access.ts";

export const Page = usersPage(Access);
const Profile = Schema.Struct({ email: Schema.String, id: Schema.String, name: Schema.String, role: Schema.String });
export interface LogRecord {
	readonly annotations: Readonly<Record<string, unknown>>;
	readonly message: unknown;
}

export const usersEngine = Effect.gen(function* () {
	const sql = yield* SqlClient.SqlClient;
	const database = yield* PostgresTestDatabase;
	const pool = yield* authDatabase(database.url);
	const { auth } = yield* betterAuthMount({
		"baseURL": "http://localhost",
		database: pool,
		secret: "admin-user-story-secret-at-least-32-characters",
		user: { additionalFields: { role: { defaultValue: "user", input: false, type: "string" } } },
	});
	const context = yield* Effect.promise(() => auth.$context);
	yield* Effect.promise(() => context.runMigrations());
	function register(id: string, role: typeof Access.Role.Type) {
		return Effect.promise(() =>
			context.internalAdapter.createUser({ email: `${id}@app.test`, emailVerified: true, id, name: id, role }, { method: "admin" }),
		);
	}
	// The story begins with users already registered; it exercises role assignment over RPC.
	for (const [id, role] of [
		["alice", "owner"],
		["bob", "user"],
		["carol", "auditor"],
	] as const) {
		yield* register(id, role);
	}
	const logs: LogRecord[] = [];
	const logger = Logger.layer([
		Logger.make((options) => {
			logs.push({ annotations: options.fiber.getRef(References.CurrentLogAnnotations), message: options.message });
		}),
	]);
	const live = yield* makeLiveServer.pipe(Effect.provide(Reactivity.layer));
	const handlers = Layer.merge(usersHandlers(Page, Access), hostChanges(Page.contract, AppChanges)).pipe(
		Layer.provide(Layer.succeed(AppChanges, live)),
		Layer.provide(Layer.succeed(SqlClient.SqlClient, sql)),
		Layer.provide(logger),
	);
	function currentUser(id: string) {
		return Effect.tryPromise(() => context.internalAdapter.findUserById(id)).pipe(
			Effect.flatMap(Schema.decodeUnknownEffect(Profile)),
			Effect.map((user) => Option.some({ user })),
			Effect.mapError(() => new AuthUnavailable({ message: "Could not resolve session" })),
		);
	}
	function clientAs(id: string) {
		const authLayer = permissionLayer(UsersPermission, { origin: () => true, provider: { get: () => currentUser(id) }, roles: Access });
		return RpcTest.makeClient(Page.contract).pipe(Effect.provide(Layer.merge(handlers, authLayer)));
	}
	return { answers: new Map<string, string>(), assignment: { finished: 0, started: 0 }, clientAs, logs, register };
});
