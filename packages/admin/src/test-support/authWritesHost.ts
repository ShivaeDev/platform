import { ConfigProvider, Context, Effect, Layer, Option } from "effect";
import { HttpServer } from "effect/http";
import * as NetAddress from "effect/net/NetAddress";
import * as AtomRegistry from "effect/reactivity/AtomRegistry";
import { Migrator } from "effect/sql";
import { role } from "@shivaedev/access/role.ts";
import { roleSet } from "@shivaedev/access/roleSet.ts";
import { bind, makeClient } from "@shivaedev/contract/bind.ts";
import { moduleHandlers } from "@shivaedev/contract/moduleHandlers.ts";
import { Sessions } from "@shivaedev/identity/Sessions.ts";
import { defineAuth } from "@shivaedev/identity/server/better-auth/define.ts";
import { migrateBetterAuth } from "@shivaedev/identity/server/better-auth/migrate.ts";
import { betterAuthMount } from "@shivaedev/identity/server/better-auth/mount.ts";
import { betterAuthUserDirectory } from "@shivaedev/identity/server/better-auth/userDirectory.ts";
import { SessionPolicy } from "@shivaedev/identity/server/SessionPolicy.ts";
import { ManageSessions } from "@shivaedev/identity/sessionPermissions.ts";
import { memoryStore } from "@shivaedev/rate-limit/memoryStore.ts";
import { appHost } from "@shivaedev/server/appDatabase.ts";
import { PostgresTestDatabase } from "@shivaedev/test-sql/server/database.ts";
import { ReadUsers } from "#permissions.ts";
import { adminRegistry } from "#registry.ts";
import { registerAdmin } from "#server/registerAdmin.ts";
import { SessionsPage } from "#sessions/Page.ts";
import { clientRuntime } from "#test/clientRuntime.ts";
import { Users } from "#Users.ts";
import { UsersPage } from "#users/Page.ts";

const Access = roleSet(role("user", []), role("admin", [ReadUsers, ManageSessions]));
const auth = defineAuth({
	defaultRole: "user",
	options: {
		emailAndPassword: { enabled: true },
		logger: { disabled: true },
		secret: "admin-auth-writes-story-secret-at-least-32-characters",
		session: { cookieCache: { enabled: false } },
	},
	roles: Access,
});
const viewer = { email: "admin@app.test", id: "admin", name: "admin", role: "admin" };

const application = Effect.gen(function* () {
	yield* migrateBetterAuth(auth.options, auth);
	const { routes } = yield* betterAuthMount(auth).pipe(
		Effect.provide(memoryStore),
		Effect.provide(ConfigProvider.layer(ConfigProvider.fromEnv({ env: { "AUTH_RATE_LIMIT_ENABLED": "false" } }))),
	);
	const registration = registerAdmin(adminRegistry(UsersPage, SessionsPage), { sessions: moduleHandlers(Sessions), users: moduleHandlers(Users) });
	return {
		group: registration.group,
		handlers: registration.handlers,
		routes,
		services: betterAuthUserDirectory(auth),
		sessions: Layer.succeed(SessionPolicy, {
			origin: () => true,
			provider: { get: () => Effect.succeed(Option.some({ user: viewer })) },
			roles: Access,
		}),
	};
});

// Better Auth writes through its HTTP routes on the same host whose live streams serve the admin screens.
export const authWritesHost = Effect.gen(function* () {
	const database = yield* PostgresTestDatabase;
	const services = yield* Layer.build(
		appHost({
			application,
			config: { databaseUrl: database.url, host: "127.0.0.1", port: 0 },
			migrations: { loader: Migrator.fromRecord({}), lockTimeout: "5 seconds" },
			postgresSettings: {},
		}),
	);
	const server = Context.get(services, HttpServer.HttpServer);
	if (!NetAddress.isInetAddress(server.address)) {
		return yield* Effect.die("Expected a TCP listener");
	}
	const baseUrl = `http://127.0.0.1:${server.address.port}`;
	const registry = yield* Effect.acquireRelease(
		Effect.sync(() => AtomRegistry.make()),
		(current) => Effect.sync(() => current.dispose()),
	);
	const transport = makeClient(UsersPage.contract, {
		group: adminRegistry(UsersPage, SessionsPage).group,
		registry,
		runtime: yield* clientRuntime,
		url: `${baseUrl}/rpc`,
	});
	const sessions = bind(SessionsPage.contract, transport.Client, { registry });
	return {
		baseUrl,
		cookies: new Map<string, string>(),
		registry,
		sessions: sessions.list.query({ limit: 20 }),
		transport,
		users: transport.api.list.query({ limit: 20 }),
	};
});
