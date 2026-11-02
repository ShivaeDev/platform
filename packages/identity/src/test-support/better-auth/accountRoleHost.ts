import { createServer } from "node:http";
import { NodeHttpServer } from "@effect/platform-node";
import { testUtils } from "better-auth/plugins";
import { Config, ConfigProvider, Context, Effect, Layer, Queue, Schema, type Scope } from "effect";
import { HttpRouter, HttpServer } from "effect/http";
import * as NetAddress from "effect/net/NetAddress";
import * as Reactivity from "effect/reactivity/Reactivity";
import type { SqlClient } from "effect/sql";
import type { SqlError } from "effect/sql/SqlError";
import { role } from "@shivaedev/access/role.ts";
import { roleSet } from "@shivaedev/access/roleSet.ts";
import { AssignRoles } from "@shivaedev/access/roles.ts";
import { memoryStore } from "@shivaedev/rate-limit/memoryStore.ts";
import { accountRoleSeed } from "#server/better-auth/accountRoleSeed.ts";
import { betterAuthDatabase } from "#server/better-auth/adapters/database.ts";
import { ProviderAccounts } from "#server/better-auth/allowedAccounts.ts";
import { assertBetterAuthSchema } from "#server/better-auth/assertSchema.ts";
import { migrateBetterAuth } from "#server/better-auth/migrate.ts";
import { betterAuthMount } from "#server/better-auth/mount.ts";
import type { AuthTableOptions } from "#server/better-auth/tables.ts";
import { authTestDatabase } from "#server/better-auth/testDatabase.ts";
import { signedInUser } from "#server/better-auth/testing.ts";
import { gitHubSignIn } from "#test/sign-in-policy/flows.ts";

const Access = roleSet(role("user", []), role("operator", []), role("admin", [AssignRoles]));
const Session = Schema.Struct({ user: Schema.Struct({ role: Schema.String }) });
export type SeedRole = typeof Access.Role.Type;
export type Person = "alice" | "bob";
const people = { alice: "1001", bob: "1002" };

export const accountRoleHost = Effect.fnUntraced(function* (mapping: AuthTableOptions = {}) {
	const env: Record<string, string | undefined> = { "AUTH_RATE_LIMIT_ENABLED": "false" };
	const config = ConfigProvider.layer(ConfigProvider.fromEnvRecord(env));
	const options = {
		...mapping,
		database: yield* betterAuthDatabase(),
		logger: { disabled: true },
		plugins: [...(mapping.plugins ?? []), testUtils()],
		secret: "account-role-story-secret-at-least-32-characters",
		socialProviders: { github: { clientId: "story-client", clientSecret: "story-secret" } },
	};
	yield* migrateBetterAuth(options, { defaultRole: "user" });
	const base = yield* betterAuthMount(options, { defaultRole: "user", roles: Access }).pipe(Effect.provide(memoryStore)).pipe(Effect.provide(config));
	const baseApp = HttpRouter.toWebHandler(base.routes, { disableLogger: true });
	yield* Effect.addFinalizer(() => Effect.promise(() => baseApp.dispose()));
	const cookies = new Map<Person, string>();
	let baseUrl = "";
	let seededRole: SeedRole = "operator";
	let reactivity: Reactivity.Reactivity | undefined;
	let observed: Queue.Dequeue<readonly { email: string; role: string | null }[], SqlError> | undefined;
	const start = Effect.fnUntraced(function* () {
		const mount = betterAuthMount(options, {
			defaultRole: "user",
			roleSeed: accountRoleSeed(Access, seededRole, Config.schema(ProviderAccounts, "AUTH_OPERATOR_ACCOUNTS").pipe(Config.withDefault([])), options),
			roles: Access,
		})
			.pipe(Effect.provide(memoryStore))
			.pipe(Effect.provide(config));
		// Server-only stories must not inherit the PostgreSQL kit's Reactivity service.
		const mounted = yield* reactivity === undefined
			? mount.pipe(
					Effect.updateContext((services: Context.Context<SqlClient.SqlClient | Scope.Scope>) => Context.omit(Reactivity.Reactivity)(services)),
				)
			: mount.pipe(Effect.provideService(Reactivity.Reactivity, reactivity));
		const context = yield* Layer.build(
			HttpRouter.serve(mounted.routes, { disableLogger: true }).pipe(
				Layer.provideMerge(NodeHttpServer.layer(createServer, { host: "127.0.0.1", port: 0 })),
			),
		);
		const server = yield* HttpServer.HttpServer.pipe(Effect.provideContext(context));
		if (!NetAddress.isInetAddress(server.address)) {
			return yield* Effect.die("Account role host needs a TCP listener");
		}
		baseUrl = `http://127.0.0.1:${server.address.port}`;
	});
	return {
		checkSchema: () => assertBetterAuthSchema(options, { defaultRole: "user" }).pipe(Effect.as("matches")),
		configure: (entries: string | undefined, assignedRole: SeedRole = "operator") => {
			env.AUTH_OPERATOR_ACCOUNTS = entries;
			seededRole = assignedRole;
		},
		// Minted sessions isolate boot-time grants from OAuth registration.
		mint: (person: Person, storedRole: SeedRole = "user") =>
			Effect.gen(function* () {
				const session = yield* signedInUser(base.auth, {
					email: `${person}@github.test`,
					name: person,
					providerAccounts: [{ accountId: people[person], providerId: "github" }],
					role: storedRole,
				});
				cookies.set(person, session.headers.get("cookie") ?? "");
			}),
		observedStoredRoles: () => (observed === undefined ? Effect.die("No Users observer is registered") : Queue.take(observed)),
		observeUsers: () =>
			Effect.gen(function* () {
				reactivity = yield* Reactivity.make;
				const storage = yield* authTestDatabase;
				observed = yield* reactivity.query(["admin.users"], storage.userRoles);
			}),
		sessionRole: (person: Person) =>
			Effect.promise(async () => {
				const request = new Request(`${baseUrl || "http://localhost:3000"}/api/auth/get-session`, {
					headers: { cookie: cookies.get(person) ?? "" },
				});
				const response = await (baseUrl === "" ? baseApp.handler(request) : fetch(request));
				return Schema.decodeUnknownSync(Session)(await response.json()).user.role;
			}),
		signIn: (person: Person) =>
			Effect.promise(async () => {
				const result = await gitHubSignIn(baseUrl, people[person], "browser");
				if (!result.signedIn) {
					throw new Error(`${person} could not sign in: ${result.error}`);
				}
				cookies.set(person, result.cookie);
			}),
		start,
	};
});
