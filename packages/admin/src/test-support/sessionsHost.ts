import { Effect, Layer, Option } from "effect";
import { RpcClient, RpcSerialization } from "effect/rpc";
import * as Socket from "effect/socket/Socket";
import { SqlClient } from "effect/sql";
import { role } from "@shivaedev/access/role.ts";
import { roleSet } from "@shivaedev/access/roleSet.ts";
import { makeClient } from "@shivaedev/contract/bind.ts";
import { clientActivity } from "@shivaedev/contract/clientActivity.ts";
import { moduleHandlers } from "@shivaedev/contract/moduleHandlers.ts";
import { AuthUnavailable } from "@shivaedev/errors/taxonomy.ts";
import { Sessions } from "@shivaedev/identity/Sessions.ts";
import { betterAuthDatabase } from "@shivaedev/identity/server/better-auth/adapters/database.ts";
import { migrateBetterAuth } from "@shivaedev/identity/server/better-auth/migrate.ts";
import { betterAuthMount } from "@shivaedev/identity/server/better-auth/mount.ts";
import { permissionLayer } from "@shivaedev/identity/server/permissionLayer.ts";
import { SessionPolicy } from "@shivaedev/identity/server/SessionPolicy.ts";
import { ManageSessions, SessionsPermission } from "@shivaedev/identity/sessionPermissions.ts";
import { memoryStore } from "@shivaedev/rate-limit/memoryStore.ts";
import { liveHost } from "@shivaedev/test-kits/contract/liveMemoryProtocol.ts";
import { rpcSocketHost } from "@shivaedev/test-story/server/rpcSocketHost.ts";
import { SessionsPage } from "#sessions/Page.ts";
import { clientRuntime } from "#test/clientRuntime.ts";

const Access = roleSet(role("admin", [ManageSessions]), role("user", []));

export const sessionsHost = Effect.fnUntraced(function* () {
	const options = {
		"baseURL": "http://localhost",
		database: yield* betterAuthDatabase(),
		logger: { disabled: true },
		secret: "admin-sessions-story-secret-at-least-32-characters",
		user: { additionalFields: { role: { defaultValue: "user", input: false, type: "string" as const } } },
	};
	yield* migrateBetterAuth({ options });
	const { auth } = yield* betterAuthMount({ options }).pipe(Effect.provide(memoryStore));
	const context = yield* Effect.promise(() => auth.$context);
	// Sessions are preconditions; the stories exercise administration rather than sign-in.
	function mint(name: string, activity = "2026-01-04T12:00:00Z") {
		return Effect.promise(async () => {
			const user = await context.internalAdapter.createUser(
				{ email: `${name}@app.test`, emailVerified: true, name, role: name === "alice" ? "admin" : "user" },
				{ method: "admin" },
			);
			const session = await context.internalAdapter.createSession(user.id);
			await context.internalAdapter.updateSession(session.token, {
				createdAt: new Date("2026-01-01T12:00:00Z"),
				expiresAt: new Date("2100-01-01T12:00:00Z"),
				updatedAt: new Date(activity),
			});
			return { name, session, user };
		});
	}
	const alice = yield* mint("alice", "2026-01-03T12:00:00Z");
	const bob = yield* mint("bob", "2026-01-02T12:00:00Z");
	const accounts = [alice, bob];
	let viewer = alice;
	const policy = {
		origin: () => true,
		provider: {
			get: () =>
				Effect.tryPromise(() => context.internalAdapter.findSession(viewer.session.token)).pipe(
					Effect.map(Option.fromNullOr),
					Effect.mapError(() => new AuthUnavailable({ message: "Session lookup failed" })),
				),
		},
		roles: Access,
	};
	const sql = yield* SqlClient.SqlClient;
	const host = yield* liveHost(SessionsPage.contract, moduleHandlers(Sessions).pipe(Layer.provide(Layer.succeed(SqlClient.SqlClient, sql))), {
		protocol: "websocket",
	});
	const served = yield* rpcSocketHost(
		host.group,
		Layer.mergeAll(host.handlers, permissionLayer(SessionsPermission)).pipe(Layer.provide(Layer.succeed(SessionPolicy, policy))),
	);
	const url = served.url.replace(/^http/u, "ws");
	const protocol = RpcClient.layerProtocolSocket().pipe(
		Layer.provide([Socket.layerWebSocket(url).pipe(Layer.provide(Socket.layerWebSocketConstructorGlobal)), RpcSerialization.layerNdjson]),
	);
	const runtime = yield* clientRuntime;
	const transport = makeClient(SessionsPage.contract, { protocol, runtime, url });
	const client = yield* transport.client;
	return {
		accounts,
		activity: clientActivity(transport),
		addSessions: (names: readonly string[]) => Effect.forEach(names, (name) => mint(name), { discard: true }),
		api: transport.api,
		as: (name: string) => {
			const account = accounts.find((candidate) => candidate.name === name);
			if (account === undefined) {
				throw new Error(`No session for ${name}`);
			}
			viewer = account;
		},
		revokeElsewhere: (name: string) => {
			const account = accounts.find((candidate) => candidate.name === name);
			if (account === undefined) {
				throw new Error(`No session for ${name}`);
			}
			return client["identity.sessions.revoke"]({ id: account.session.id });
		},
		runtime: transport.runtime,
		viewerId: () => viewer.session.id,
	};
});
