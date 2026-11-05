import { ConfigProvider, Effect, Option, Redacted } from "effect";
import { role } from "@shivaedev/access/role.ts";
import { roleSet } from "@shivaedev/access/roleSet.ts";
import { CurrentViewer } from "@shivaedev/contract/readPolicy.ts";
import { memoryStore } from "@shivaedev/rate-limit/memoryStore.ts";
import { PostgresTestDatabase } from "@shivaedev/test-sql/server/database.ts";
import { makePostgresTestLayer } from "@shivaedev/test-sql/server/postgres.ts";
import { storyKit } from "@shivaedev/test-story/server/storyKit.ts";
import { Identity, SessionUser, type SessionUserValue } from "#identity.ts";
import { AssignRoles } from "#roles.ts";
import { betterAuthDatabase } from "#server/better-auth/adapters/database.ts";
import { defineSeed } from "#server/better-auth/adapters/defineSeed.ts";
import { migrateBetterAuth } from "#server/better-auth/adapters/migrate.ts";
import { betterAuthMount } from "#server/better-auth/adapters/mount.ts";
import { betterAuthUserDirectory } from "#server/better-auth/adapters/userDirectory.ts";
import { UserDirectory } from "#server/UserDirectory.ts";
import { storyClock, withIdentityDatabase } from "#test/clock.ts";
import { databaseUrl } from "#test/postgres.ts";

const roles = roleSet(role("reader", []), role("owner", [AssignRoles]));
const authOptions = {
	"baseURL": "http://localhost:3000",
	emailAndPassword: { enabled: true },
	secret: "demo-seed-story-secret-at-least-32-characters",
};
const password = Redacted.make("demo-password-for-local-use");
const users = [
	{ email: "alice@demo.test", name: "alice", password, role: "owner" },
	{ email: "bob@demo.test", name: "bob", password, role: "reader" },
] as const;
const postgres = makePostgresTestLayer({
	initialize: migrateBetterAuth(authOptions, { defaultRole: "reader" }),
	url: Redacted.make(databaseUrl ?? "postgresql://integration-tests-disabled"),
});

export const demoSeedStory = storyKit({
	around: withIdentityDatabase,
	clock: storyClock,
	*create() {
		const { url } = yield* PostgresTestDatabase;
		const { auth } = yield* betterAuthMount({ ...authOptions, database: yield* betterAuthDatabase() }, { defaultRole: "reader", roles }).pipe(
			Effect.provide(memoryStore),
		);
		const runs: (SessionUserValue & { readonly identityId: string; readonly viewerId: string | undefined })[] = [];
		return { auth, runs, url };
	},
	layer: postgres,
	name: "demo personas on PostgreSQL",
	runIf: databaseUrl !== undefined,
	stages: [],
	verbs: (engine, story) => ({
		promoteBob: () =>
			Effect.gen(function* () {
				story.tell("bob is promoted to owner through identity");
				const directory = yield* UserDirectory;
				const { users: members } = yield* directory.list({ limit: 20 });
				const bob = members.find((user) => user.email === "bob@demo.test");
				if (bob === undefined) {
					return yield* Effect.die("bob has not been seeded");
				}
				return yield* directory.assignRole(bob.id, "owner");
			}).pipe(Effect.provide(betterAuthUserDirectory(roles))),
		run: (target?: string, replacementPassword = password, nameSuffix = "") => {
			story.tell("the app runs its demo seed declaration");
			return defineSeed({
				auth: authOptions,
				defaultRole: "reader",
				roles,
				run: Effect.gen(function* () {
					const identity = yield* Identity;
					const user = yield* SessionUser;
					const viewer = yield* CurrentViewer;
					engine.runs.push({ ...user, identityId: identity.id, viewerId: Option.getOrUndefined(viewer)?.id });
				}),
				users: users.map((user) => ({ ...user, name: `${user.name}${nameSuffix}`, password: replacementPassword })),
			}).pipe(
				Effect.provide(ConfigProvider.layer(ConfigProvider.fromEnv({ env: { "DATABASE_URL": target ?? Redacted.value(engine.url) } }))),
				Effect.as("seeded"),
				Effect.catchTag("NonLocalSeedDatabase", (error) => Effect.succeed(error.message)),
			);
		},
		runs: () => Effect.sync(() => [...engine.runs]),
		signIn: (email: string) =>
			Effect.tryPromise(() => engine.auth.api.signInEmail({ body: { email, password: Redacted.value(password) } })).pipe(
				Effect.map(({ user }) => ({ email: user.email, name: user.name })),
			),
		storedUsers: () =>
			Effect.flatMap(UserDirectory, (directory) => directory.list({ limit: 20 })).pipe(
				Effect.map(({ users: stored }) => [...stored].sort((a, b) => a.email.localeCompare(b.email))),
				Effect.provide(betterAuthUserDirectory(roles)),
			),
	}),
});
