import { Clock, Effect, Layer, Logger, Option, References, Schema, Tracer } from "effect";
import { FetchHttpClient, HttpRouter } from "effect/http";
import * as Reactivity from "effect/reactivity/Reactivity";
import { RpcClient, RpcSerialization, RpcServer } from "effect/rpc";
import { SqlClient } from "effect/sql";
import { liveServerLayer } from "@shivaedev/contract/live-server/layer.ts";
import { LiveServer } from "@shivaedev/contract/live-server/service.ts";
import { AuthUnavailable } from "@shivaedev/errors/taxonomy.ts";
import { betterAuthDatabase } from "@shivaedev/identity/server/better-auth/adapters/database.ts";
import { betterAuthMount } from "@shivaedev/identity/server/better-auth/adapters/mount.ts";
import type { AuthTableOptions } from "@shivaedev/identity/server/better-auth/adapters/tables.ts";
import { migrateBetterAuth } from "@shivaedev/identity/server/better-auth/migrate.ts";
import { betterAuthUserDirectory } from "@shivaedev/identity/server/better-auth/userDirectory.ts";
import { SessionPolicy } from "@shivaedev/identity/server/SessionPolicy.ts";
import { DirectoryUser } from "@shivaedev/identity/users.ts";
import { memoryStore } from "@shivaedev/rate-limit/memoryStore.ts";
import { hostChanges } from "@shivaedev/server/hostChanges.ts";
import { adminRegistry } from "#registry.ts";
import { registerAdmin } from "#server/registerAdmin.ts";
import { usersHandlers } from "#server/usersHandlers.ts";
import { Access } from "#test/Access.ts";
import { usersPage } from "#users/page.ts";

export const Page = usersPage(Access);
const Profile = DirectoryUser.mapFields(({ email, id, name, role }) => ({ email, id, name, role }));
export interface LogRecord {
	readonly annotations: Readonly<Record<string, unknown>>;
	readonly message: unknown;
}

export const makeUsersEngine = Effect.fnUntraced(function* (mapping: AuthTableOptions = {}) {
	const clock = yield* Clock.Clock;
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
	const reactivity = Layer.succeed(Reactivity.Reactivity, yield* Reactivity.make);
	const live = yield* LiveServer.pipe(Effect.provide(liveServerLayer.pipe(Layer.provide(reactivity))));
	const registration = registerAdmin(adminRegistry(Page), { users: usersHandlers(Page) });
	const handlers = hostChanges(registration.group)
		.pipe(Layer.provideMerge(registration.handlers))
		.pipe(
			Layer.provide(Layer.succeed(LiveServer, live)),
			Layer.provide(betterAuthUserDirectory(Access, authOptions)),
			Layer.provide(Layer.succeed(SqlClient.SqlClient, sql)),
			Layer.provide(logger),
			Layer.provide(reactivity),
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
			const app = HttpRouter.toWebHandler(
				RpcServer.layerHttp({ group: registration.group, path: "/rpc", protocol: "http" }).pipe(
					Layer.provide([handlers, RpcSerialization.layerNdjson, Layer.succeed(Tracer.Tracer, tracer), Layer.succeed(Clock.Clock, clock)]),
					Layer.provide(Layer.succeed(SessionPolicy, { origin: () => true, provider: { get: () => currentUser(id) }, roles: Access })),
				),
				{ disableLogger: true },
			);
			yield* Effect.addFinalizer(() => Effect.promise(() => app.dispose()));
			const protocol = RpcClient.layerProtocolHttp({ url: "http://localhost/rpc" }).pipe(
				Layer.provide([FetchHttpClient.layer, RpcSerialization.layerNdjson]),
				Layer.provide(Layer.succeed(FetchHttpClient.Fetch, (input, init) => app.handler(new Request(input, init)))),
			);
			return protocol;
		});
	}
	function clientAs(id: string) {
		return protocolAs(id).pipe(Effect.flatMap((protocol) => RpcClient.make(Page.contract).pipe(Effect.provide(protocol))));
	}
	return { answers: new Map<string, string>(), assignment: { finished: 0, started: 0 }, clientAs, logs, protocolAs, register, spans };
});

export const usersEngine = makeUsersEngine();
