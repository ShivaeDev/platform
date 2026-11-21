import { Effect, Layer, Logger, Option, References, Schema, Tracer } from "effect";
import { RpcClient, RpcSerialization } from "effect/rpc";
import * as Socket from "effect/socket/Socket";
import { SqlClient } from "effect/sql";
import { moduleHandlers } from "@shivaedev/contract/moduleHandlers.ts";
import { AuthUnavailable } from "@shivaedev/errors/taxonomy.ts";
import { betterAuthDatabase } from "@shivaedev/identity/server/better-auth/adapters/database.ts";
import { migrateBetterAuth } from "@shivaedev/identity/server/better-auth/migrate.ts";
import { betterAuthMount } from "@shivaedev/identity/server/better-auth/mount.ts";
import type { AuthTableOptions } from "@shivaedev/identity/server/better-auth/tables.ts";
import { betterAuthUserDirectory } from "@shivaedev/identity/server/better-auth/userDirectory.ts";
import { SessionPolicy } from "@shivaedev/identity/server/SessionPolicy.ts";
import { DirectoryUser } from "@shivaedev/identity/users.ts";
import { memoryStore } from "@shivaedev/rate-limit/memoryStore.ts";
import { liveChannel, liveHost } from "@shivaedev/test-kits/contract/liveMemoryProtocol.ts";
import { rpcSocketHost } from "@shivaedev/test-story/server/rpcSocketHost.ts";
import { adminRegistry } from "#registry.ts";
import { registerAdmin } from "#server/registerAdmin.ts";
import { Access } from "#test/Access.ts";
import { Users } from "#Users.ts";
import { UsersPage } from "#users/Page.ts";

const Profile = DirectoryUser.mapFields(({ email, id, name, role }) => ({ email, id, name, role }));
export interface LogRecord {
	readonly annotations: Readonly<Record<string, unknown>>;
	readonly message: unknown;
}

export const makeUsersEngine = Effect.fnUntraced(function* (mapping: AuthTableOptions = {}) {
	const sql = yield* SqlClient.SqlClient;
	const pool = yield* betterAuthDatabase();
	const authOptions = {
		...mapping,
		"baseURL": "http://localhost",
		database: pool,
		secret: "admin-user-story-secret-at-least-32-characters",
		user: {
			...mapping.user,
			additionalFields: { role: { ...mapping.user?.additionalFields?.role, defaultValue: "user", input: false, type: "string" as const } },
		},
	};
	yield* migrateBetterAuth(authOptions);
	const { auth } = yield* betterAuthMount(authOptions).pipe(Effect.provide(memoryStore));
	const context = yield* Effect.promise(() => auth.$context);
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
		yield* register(id, role, new Date("2026-10-20T12:34:56Z"));
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
	const registration = registerAdmin(adminRegistry(UsersPage), { users: moduleHandlers(Users) });
	// Every caller's transport shares one change channel, so a change made through one is pushed to the others.
	const channel = Layer.succeedContext(yield* Layer.build(liveChannel()));
	const host = yield* liveHost(
		registration.group,
		registration.handlers.pipe(
			Layer.provide(betterAuthUserDirectory(Access, authOptions)),
			Layer.provide(Layer.succeed(SqlClient.SqlClient, sql)),
			Layer.provide(logger),
		),
		{ channel, protocol: "websocket" },
	);
	function currentUser(id: string) {
		return Effect.tryPromise(() => context.internalAdapter.findUserById(id)).pipe(
			Effect.flatMap(Schema.decodeUnknownEffect(Profile)),
			Effect.map((user) => Option.some({ user })),
			Effect.mapError(() => new AuthUnavailable({ message: "Could not resolve session" })),
		);
	}
	function protocolAs(id: string) {
		return Effect.gen(function* () {
			const policy = { origin: () => true, provider: { get: () => currentUser(id) }, roles: Access };
			const served = yield* rpcSocketHost(host.group, host.handlers.pipe(Layer.provide(Layer.succeed(SessionPolicy, policy)))).pipe(
				Effect.provideService(Tracer.Tracer, tracer),
			);
			return RpcClient.layerProtocolSocket().pipe(
				Layer.provide([
					Socket.layerWebSocket(served.url.replace(/^http/u, "ws")).pipe(Layer.provide(Socket.layerWebSocketConstructorGlobal)),
					RpcSerialization.layerNdjson,
				]),
			);
		});
	}
	function clientAs(id: string) {
		return protocolAs(id).pipe(
			Effect.flatMap(Layer.build),
			Effect.flatMap((protocol) => RpcClient.make(UsersPage.contract).pipe(Effect.provideContext(protocol))),
		);
	}
	return { answers: new Map<string, string>(), assignment: { finished: 0, started: 0 }, clientAs, logs, protocolAs, register, spans };
});

export const usersEngine = makeUsersEngine();
