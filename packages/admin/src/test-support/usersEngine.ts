import { Effect, Layer, Logger, Option, References, Schema, Tracer } from "effect";
import { FetchHttpClient, HttpRouter } from "effect/http";
import * as Reactivity from "effect/reactivity/Reactivity";
import { RpcClient, RpcSerialization, RpcServer } from "effect/rpc";
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
import { AppUser } from "#users/roles.ts";
import { Access } from "./Access.ts";

export const Page = usersPage(Access);
const Profile = AppUser.mapFields(({ email, id, name, role }) => ({ email, id, name, role }));
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
	function register(id: string, role: typeof Access.Role.Type, createdAt?: Date) {
		return Effect.promise(() =>
			context.internalAdapter.createUser(
				{ ...(createdAt === undefined ? {} : { createdAt }), email: `${id}@app.test`, emailVerified: true, id, name: id, role },
				{ method: "admin" },
			),
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
	const spans: Tracer.NativeSpan[] = [];
	const tracer = Tracer.make({
		span: (options) => {
			const span = new Tracer.NativeSpan(options);
			spans.push(span);
			return span;
		},
	});
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
		Layer.provide(Reactivity.layer),
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
		return Effect.gen(function* () {
			const app = HttpRouter.toWebHandler(
				RpcServer.layerHttp({ group: Page.contract, path: "/rpc", protocol: "http" }).pipe(
					Layer.provide([handlers, authLayer, RpcSerialization.layerJson, Layer.succeed(Tracer.Tracer, tracer)]),
				),
				{ disableLogger: true },
			);
			yield* Effect.addFinalizer(() => Effect.promise(() => app.dispose()));
			const protocol = RpcClient.layerProtocolHttp({ url: "http://localhost/rpc" }).pipe(
				Layer.provide([FetchHttpClient.layer, RpcSerialization.layerJson]),
				Layer.provide(Layer.succeed(FetchHttpClient.Fetch, (input, init) => app.handler(new Request(input, init)))),
			);
			return yield* RpcClient.make(Page.contract).pipe(Effect.provide(protocol));
		});
	}
	return { answers: new Map<string, string>(), assignment: { finished: 0, started: 0 }, clientAs, logs, register, spans };
});
