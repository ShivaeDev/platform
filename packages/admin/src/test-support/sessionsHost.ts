import { Effect, Layer, Option } from "effect";
import { FetchHttpClient, HttpRouter, HttpServer } from "effect/http";
import * as NetAddress from "effect/net/NetAddress";
import * as Reactivity from "effect/reactivity/Reactivity";
import { RpcClient, RpcSerialization, RpcServer } from "effect/rpc";
import { SqlClient } from "effect/sql";
import { role } from "@shivaedev/access/role.ts";
import { roleSet } from "@shivaedev/access/roleSet.ts";
import { makeClient } from "@shivaedev/contract/bind.ts";
import { clientActivity } from "@shivaedev/contract/clientActivity.ts";
import { LiveServer } from "@shivaedev/contract/LiveServer.ts";
import { AuthUnavailable } from "@shivaedev/errors/taxonomy.ts";
import { betterAuthDatabase } from "@shivaedev/identity/server/better-auth/adapters/database.ts";
import { betterAuthMount } from "@shivaedev/identity/server/better-auth/mount.ts";
import { sessionsHandlers } from "@shivaedev/identity/server/better-auth/sessionsHandlers.ts";
import { permissionLayer } from "@shivaedev/identity/server/permissions.ts";
import { SessionPolicy } from "@shivaedev/identity/server/SessionPolicy.ts";
import { ManageSessions, SessionsPermission } from "@shivaedev/identity/sessionPermissions.ts";
import { memoryStore } from "@shivaedev/rate-limit/memoryStore.ts";
import { hostChanges } from "@shivaedev/server/hostChanges.ts";
import { nodeHttpServer } from "@shivaedev/server/nodeHttpServer.ts";
import { SessionsPage } from "#sessions/Page.ts";

const Access = roleSet(role("admin", [ManageSessions]), role("user", []));

export const sessionsHost = Effect.fnUntraced(function* () {
	const { auth } = yield* betterAuthMount({
		"baseURL": "http://localhost",
		database: yield* betterAuthDatabase(),
		logger: { disabled: true },
		secret: "admin-sessions-story-secret-at-least-32-characters",
		user: { additionalFields: { role: { defaultValue: "user", input: false, type: "string" } } },
	}).pipe(Effect.provide(memoryStore));
	const context = yield* Effect.promise(() => auth.$context);
	yield* Effect.promise(() => context.runMigrations());
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
	const live = yield* LiveServer.pipe(Effect.provide(LiveServer.layer.pipe(Layer.provide(Reactivity.layer))));
	const handlers = Layer.merge(sessionsHandlers, hostChanges(SessionsPage.contract)).pipe(
		Layer.provide([Layer.succeed(SqlClient.SqlClient, sql), Layer.succeed(LiveServer, live), Reactivity.layer]),
	);
	const routes = RpcServer.layerHttp({ group: SessionsPage.contract, path: "/rpc", protocol: "http" }).pipe(
		Layer.provide([handlers, permissionLayer(SessionsPermission), RpcSerialization.layerJson]),
		Layer.provide(Layer.succeed(SessionPolicy, policy)),
	);
	const handler = yield* HttpRouter.toHttpEffect(routes);
	const server = yield* Layer.build(HttpServer.serve(handler).pipe(Layer.provideMerge(nodeHttpServer("127.0.0.1", { port: 0 }))));
	const { address } = yield* HttpServer.HttpServer.pipe(Effect.provideContext(server));
	if (!NetAddress.isInetAddress(address)) {
		throw new Error("The sessions host must listen on TCP");
	}
	const baseUrl = `http://127.0.0.1:${address.port}`;
	const protocol = RpcClient.layerProtocolHttp({ url: `${baseUrl}/rpc` }).pipe(Layer.provide([FetchHttpClient.layer, RpcSerialization.layerJson]));
	const transport = makeClient(SessionsPage.contract, { live: false, protocol, url: `${baseUrl}/rpc` });
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
