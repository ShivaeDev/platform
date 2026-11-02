import { betterAuth } from "better-auth";
import { testUtils } from "better-auth/plugins";
import { ConfigProvider, Effect, Schema } from "effect";
import { HttpRouter } from "effect/http";
import { role } from "@shivaedev/access/role.ts";
import { roleSet } from "@shivaedev/access/roleSet.ts";
import { AssignRoles } from "@shivaedev/access/roles.ts";
import { memoryStore } from "@shivaedev/rate-limit/memoryStore.ts";
import { withIsolatedDatabase } from "@shivaedev/test-sql/server/withIsolatedDatabase.ts";
import { betterAuthDatabase } from "#server/better-auth/adapters/database.ts";
import { assignRole } from "#server/better-auth/assignRole.ts";
import { betterAuthMount } from "#server/better-auth/mount.ts";
import { authTestDatabase } from "#server/better-auth/testDatabase.ts";
import { signedInUser } from "#server/better-auth/testing.ts";

const Access = roleSet(role("member", []), role("admin", [AssignRoles]));
const Session = Schema.Struct({ user: Schema.Struct({ role: Schema.String }) });
const ORIGIN = "http://localhost:3000";
export type Person = "alice" | "bob";

export const roleAdoptionHost = Effect.fnUntraced(function* () {
	const options = {
		"baseURL": ORIGIN,
		database: yield* betterAuthDatabase(),
		emailAndPassword: { enabled: true },
		logger: { disabled: true },
		plugins: [testUtils()],
		secret: "role-adoption-story-secret-at-least-32-characters",
	};
	const storage = yield* authTestDatabase;
	const legacy = yield* Effect.cached(Effect.sync(() => betterAuth(options)));
	const application = yield* Effect.cached(
		Effect.gen(function* () {
			const mounted = yield* betterAuthMount(options, { defaultRole: "member", roles: Access })
				.pipe(Effect.provide(memoryStore))
				.pipe(Effect.provide(ConfigProvider.layer(ConfigProvider.fromEnv({ env: { "AUTH_RATE_LIMIT_ENABLED": "false" } }))));
			const app = HttpRouter.toWebHandler(mounted.routes, { disableLogger: true });
			yield* Effect.addFinalizer(() => Effect.promise(() => app.dispose()));
			return app;
		}),
	);
	let freshColumn: readonly { type: string; nullable: string; default: string | null }[] | undefined;
	const people = new Map<Person, { headers: Headers; user: { id: string } }>();
	function person(name: Person) {
		const found = people.get(name);
		if (found === undefined) {
			throw new Error(`No session for ${name}`);
		}
		return found;
	}
	return {
		assignAdmin: (name: Person) => assignRole(Access, person(name).user.id, "admin"),
		createFreshSchema: () =>
			withIsolatedDatabase(
				Effect.gen(function* () {
					const fresh = yield* authTestDatabase;
					yield* fresh.migrate({ emailAndPassword: options.emailAndPassword }, { defaultRole: "member" });
					freshColumn = yield* fresh.roleColumn;
				}),
			),
		createSchema: (defaultRole?: string) => storage.migrate(options, defaultRole === undefined ? undefined : { defaultRole }),
		freshRoleColumn: () =>
			Effect.sync(() => {
				if (freshColumn === undefined) {
					throw new Error("No fresh schema was created");
				}
				return freshColumn;
			}),
		mint: (name: Person) =>
			Effect.gen(function* () {
				const auth = yield* legacy;
				people.set(name, yield* signedInUser(auth, { email: `${name}@roles.test`, name }));
			}),
		removeRole: (name: Person) => storage.omitRole(person(name).user.id),
		roleColumn: () => storage.roleColumn,
		sessionRole: (name: Person) =>
			Effect.flatMap(application, (app) =>
				Effect.promise(async () => {
					const response = await app.handler(new Request(`${ORIGIN}/api/auth/get-session`, { headers: person(name).headers }));
					return Schema.decodeUnknownSync(Session)(await response.json()).user.role;
				}),
			),
		signUp: (name: Person) =>
			Effect.flatMap(application, (app) =>
				Effect.promise(async () => {
					const response = await app.handler(
						new Request(`${ORIGIN}/api/auth/sign-up/email`, {
							body: JSON.stringify({ email: `${name}@roles.test`, name, password: "role-adoption-password", role: "admin" }),
							headers: { "content-type": "application/json", origin: ORIGIN },
							method: "POST",
						}),
					);
					return { role: Schema.decodeUnknownSync(Session)(await response.json()).user.role, status: response.status };
				}),
			),
		storedRoles: () => storage.userRoles,
	};
});
