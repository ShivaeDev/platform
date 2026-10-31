import { betterAuth } from "better-auth";
import { testUtils } from "better-auth/plugins";
import { ConfigProvider, DateTime, Effect, Option } from "effect";
import { Headers as HttpHeaders } from "effect/http";
import * as TestClock from "effect/testing/TestClock";
import { role } from "@shivaedev/access/role.ts";
import { roleSet } from "@shivaedev/access/roleSet.ts";
import { answered } from "@shivaedev/test/answers.ts";
import { databaseUrl, postgres } from "@shivaedev/test-sql/server/emptyPostgres.ts";
import { withIsolatedDatabase } from "@shivaedev/test-sql/server/withIsolatedDatabase.ts";
import { storyKit } from "@shivaedev/test-story/server/storyKit.ts";
import { SessionUser } from "#identity.ts";
import { betterAuthDatabase } from "#server/better-auth/adapters/database.ts";
import { betterAuthMount } from "#server/better-auth/mount.ts";
import { listSessions } from "#server/better-auth/sessionAdministration.ts";
import { sweepExpiredSessions } from "#server/better-auth/sweepExpiredSessions.ts";
import { authTestDatabase } from "#server/better-auth/testDatabase.ts";
import { signedInUser } from "#server/better-auth/testing.ts";
import { withSessionUser } from "#server/session.ts";
import { ManageSessions } from "#sessionPermissions.ts";

type Person = "alice" | "bob";
const Roles = roleSet(role("admin", [ManageSessions]));

export const sessionClock = storyKit({
	around: withIsolatedDatabase,
	clock: Effect.runSync(DateTime.now),
	*create() {
		const database = yield* betterAuthDatabase();
		const options = {
			"baseURL": "http://localhost:3000",
			database,
			logger: { disabled: true },
			plugins: [testUtils()],
			secret: "session-clock-story-secret-with-at-least-32-characters",
			session: { cookieCache: { enabled: false }, disableSessionRefresh: true, expiresIn: 3600 },
			user: { additionalFields: { role: { defaultValue: "admin", input: false, type: "string" as const } } },
		};
		const mounted = yield* betterAuthMount(options, { roles: Roles }).pipe(
			Effect.provide(ConfigProvider.layer(ConfigProvider.fromEnv({ env: { "AUTH_RATE_LIMIT_ENABLED": "false" } }))),
		);
		const context = yield* Effect.promise(() => mounted.auth.$context);
		yield* Effect.promise(() => context.runMigrations());
		const alice = yield* Effect.promise(() => signedInUser(mounted.auth, { email: "alice@clock.test", name: "alice" }));
		const longerLived = betterAuth({ ...options, session: { ...options.session, expiresIn: 7200 } });
		const bob = yield* Effect.promise(() => signedInUser(longerLived, { email: "bob@clock.test", name: "bob" }));
		return {
			accounts: { alice, bob },
			extraSession: Option.none<{ readonly id: string; readonly expiresAt: Date }>(),
			mounted,
			storage: yield* authTestDatabase,
			swept: Option.none<number>(),
		};
	},
	layer: postgres,
	name: "session clock",
	runIf: databaseUrl !== undefined,
	stages: [],
	verbs: (engine, story) => {
		const { accounts, mounted, storage } = engine;
		function protectedRequest(person: Person) {
			return withSessionUser({ ...mounted.sessions, origin: () => true }, HttpHeaders.fromInput(accounts[person].headers), "story.profile");
		}
		return {
			clockReachesExpiry: (millisecondsAfter = 0) => {
				story.tell(`the test clock reaches ${millisecondsAfter} milliseconds after alice's session expiry`);
				return TestClock.setTime(accounts.alice.session.expiresAt.getTime() + millisecondsAfter);
			},
			extraSession: () => Effect.sync(() => Option.getOrThrow(engine.extraSession)),
			listedSessions: () =>
				listSessions({ limit: 100 }).pipe(
					protectedRequest("bob"),
					Effect.map(({ sessions }) => sessions.map(({ user }) => user.name).sort()),
				),
			mintAnotherSession: () =>
				Effect.gen(function* () {
					story.tell("alice starts another signed-in session");
					const context = yield* Effect.promise(() => mounted.auth.$context);
					const login = yield* Effect.promise(() => context.test.login({ userId: accounts.alice.user.id }));
					engine.extraSession = Option.some({ expiresAt: login.session.expiresAt, id: login.session.id });
				}),
			mintedSession: (person: Person) => Effect.sync(() => ({ expiresAt: accounts[person].session.expiresAt, id: accounts[person].session.id })),
			request: (person: Person) => {
				story.tell(`${person} makes a protected request with the minted cookie`);
				return Effect.map(SessionUser, (user) => user.name).pipe(protectedRequest(person), answered);
			},
			signOut: (person: Person) => {
				story.tell(`${person} signs out`);
				return Effect.promise(() => mounted.auth.api.signOut({ headers: accounts[person].headers }));
			},
			storedSessions: (person: Person) => storage.sessionsFor(accounts[person].user.id),
			sweep: () =>
				Effect.gen(function* () {
					story.tell("the worker sweeps expired sessions");
					engine.swept = Option.some(yield* sweepExpiredSessions);
				}),
			sweptSessions: () => Effect.sync(() => Option.getOrThrow(engine.swept)),
		};
	},
});
