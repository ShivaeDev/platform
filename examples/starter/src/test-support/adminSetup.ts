import { testUtils } from "better-auth/plugins";
import { ConfigProvider, Effect, Redacted } from "effect";
import { betterAuthDatabase } from "@shivaedev/identity/server/better-auth/adapters/database.ts";
import { betterAuthMount } from "@shivaedev/identity/server/better-auth/mount.ts";
import { signedInUser } from "@shivaedev/identity/server/better-auth/testing.ts";
import { migrationSteps } from "@shivaedev/test-sql/server/migrationSteps.ts";
import { withIsolatedDatabase } from "@shivaedev/test-sql/server/withIsolatedDatabase.ts";
import { storyKit } from "@shivaedev/test-story/server/storyKit.ts";
import { AppAccess } from "#AppAccess.ts";
import { User } from "#roles/User.ts";
import { authOptions } from "#server/authOptions.ts";
import { migrations } from "#server/migrations.ts";
import { type RunningHost, secret, startHost } from "#test-support/host.ts";
import { postgres } from "#test-support/postgres.ts";
import { adminCommand } from "./adminCommand.ts";

interface Engine {
	cookie: string;
	host: RunningHost | undefined;
}

export const adminSetup = storyKit({
	around: withIsolatedDatabase,
	clock: "live",
	create: (): Engine => ({ cookie: "", host: undefined }),
	layer: postgres,
	name: "admin setup",
	stages: ["database"],
	verbs: (engine, story) => {
		function host() {
			if (engine.host === undefined) {
				throw new Error("The admin app has not started");
			}
			return engine.host;
		}
		return {
			createAdmin: Effect.fn("AdminSetup.createAdmin")(function* (email: string, password: string) {
				story.tell(`run the admin bootstrap command for ${email}`);
				return yield* adminCommand(email, password);
			}),
			mintOwnerCandidate: Effect.fn("AdminSetup.mintOwnerCandidate")(function* () {
				story.tell("alice already has a GitHub account and a minted session before owner configuration");
				const { auth } = yield* betterAuthMount(
					{ ...authOptions(), database: yield* betterAuthDatabase(), plugins: [testUtils()], secret: Redacted.value(secret) },
					{ defaultRole: User.name, roles: AppAccess },
				).pipe(Effect.provide(ConfigProvider.layer(ConfigProvider.fromEnv({ env: {} }))));
				const session = yield* Effect.promise(() =>
					signedInUser(auth, { email: "alice@github.test", name: "alice", providerAccounts: [{ accountId: "1001", providerId: "github" }] }),
				);
				engine.cookie = session.headers.get("cookie") ?? "";
			}),
			prepareAuth: Effect.fn("AdminSetup.prepareAuth")(function* () {
				story.tell("prepare the app authentication tables");
				const steps = yield* migrationSteps({ ...migrations(), lockTimeout: "5 seconds" });
				yield* steps.migrateTo("0004_stored_roles");
			}),
			session: Effect.fn("AdminSetup.session")(function* () {
				const session = yield* Effect.promise(() => fetch(`${host().baseUrl}/api/auth/get-session`, { headers: { cookie: engine.cookie } }));
				const body: unknown = yield* Effect.promise(() => session.json());
				return body;
			}),
			signIn: Effect.fn("AdminSetup.signIn")(function* (email: string, password: string) {
				story.tell(`sign in to the app as ${email}`);
				const { baseUrl, origin } = host();
				const response = yield* Effect.promise(() =>
					fetch(`${baseUrl}/api/auth/sign-in/email`, {
						body: JSON.stringify({ email, password }),
						headers: { "content-type": "application/json", origin },
						method: "POST",
					}),
				);
				yield* Effect.promise(() => response.text());
				engine.cookie = response.headers
					.getSetCookie()
					.map((value) => value.split(";")[0])
					.join("; ");
				return response;
			}),
			startApp: Effect.fn("AdminSetup.startApp")(function* (ownerAccounts?: string) {
				story.tell("start the app after admin bootstrap");
				engine.host = yield* startHost(ownerAccounts === undefined ? {} : { ownerAccounts });
			}),
		};
	},
});
