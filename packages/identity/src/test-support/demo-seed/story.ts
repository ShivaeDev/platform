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
import { defineAuth } from "#server/better-auth/define.ts";
import { defineSeed } from "#server/better-auth/defineSeed.ts";
import { migrateBetterAuth } from "#server/better-auth/migrate.ts";
import { betterAuthMount } from "#server/better-auth/mount.ts";
import { provisionAdmin } from "#server/better-auth/provisionAdmin.ts";
import { betterAuthUserDirectory } from "#server/better-auth/userDirectory.ts";
import { UserDirectory } from "#server/UserDirectory.ts";
import { storyClock, withIdentityDatabase } from "#test/clock.ts";
import { databaseUrl } from "#test/postgres.ts";

const roles = roleSet(role("reader", []), role("owner", [AssignRoles]));
const auth = defineAuth({
	defaultRole: "reader",
	options: {
		"baseURL": "http://localhost:3000",
		emailAndPassword: { enabled: true },
		secret: "demo-seed-story-secret-at-least-32-characters",
	},
	roles,
});
const password = Redacted.make("demo-password-for-local-use");
const users = [
	{ email: "alice@demo.test", name: "alice", password, role: "owner" },
	{ email: "bob@demo.test", name: "bob", password, role: "reader" },
] as const;
const postgres = makePostgresTestLayer({
	initialize: migrateBetterAuth(auth.options, auth),
	url: Redacted.make(databaseUrl ?? "postgresql://integration-tests-disabled"),
});

export const demoSeedStory = storyKit({
	around: withIdentityDatabase,
	clock: storyClock,
	*create() {
		const { url } = yield* PostgresTestDatabase;
		const mounted = yield* betterAuthMount(auth).pipe(Effect.provide(memoryStore));
		const runs: (SessionUserValue & { readonly identityId: string; readonly viewerId: string | undefined })[] = [];
		return { auth: mounted.auth, runs, url };
	},
	layer: postgres,
	name: "seeded and provisioned users on PostgreSQL",
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
			}).pipe(Effect.provide(betterAuthUserDirectory(auth))),
		provisionAdmin: (email: string, adminPassword: string) => {
			story.tell(`the admin step runs for ${email}`);
			return provisionAdmin(auth, "owner").pipe(
				Effect.provide(
					ConfigProvider.layer(
						ConfigProvider.fromEnv({ env: { "ADMIN_EMAIL": email, "ADMIN_PASSWORD": adminPassword, "DATABASE_URL": Redacted.value(engine.url) } }),
					),
				),
				Effect.asVoid,
			);
		},
		run: (target?: string, replacementPassword = password, nameSuffix = "") => {
			story.tell("the app runs its demo seed declaration");
			return defineSeed(auth, {
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
		signIn: (email: string, signInPassword = Redacted.value(password)) =>
			Effect.tryPromise(() => engine.auth.api.signInEmail({ body: { email, password: signInPassword } })).pipe(
				Effect.map(({ user }) => ({ email: user.email, name: user.name })),
			),
		storedUsers: () =>
			Effect.flatMap(UserDirectory, (directory) => directory.list({ limit: 20 })).pipe(
				Effect.map(({ users: stored }) => [...stored].sort((a, b) => a.email.localeCompare(b.email))),
				Effect.provide(betterAuthUserDirectory(auth)),
			),
	}),
});
