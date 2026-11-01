import { testUtils } from "better-auth/plugins";
import { ConfigProvider, Effect, Redacted } from "effect";
import * as HttpStatus from "effect/http/HttpStatus";
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
import { adminCommand } from "./command.ts";
import { signedInAccount } from "./session.ts";

interface Engine {
	cookie: string;
	host: RunningHost | undefined;
}

export const adminSetup = storyKit({
	around: withIsolatedDatabase,
	clock: "live",
	create: (): Engine => ({ cookie: "", host: undefined }),
	inspect: ({ host }) => ({ baseUrl: host?.baseUrl }),
	layer: postgres,
	name: "admin setup",
	stages: ["database", "accounts"],
	verbs: (engine, story) => {
		function host() {
			if (engine.host === undefined) {
				throw new Error("The app has not started");
			}
			return engine.host;
		}
		return {
			adminCommandRuns: Effect.fn("AdminSetup.adminCommandRuns")(function* (email: string, password: string) {
				story.tell(`the admin bootstrap command runs for ${email}`);
				const { code } = yield* adminCommand(email, password);
				return code === 0 ? "created" : "refused";
			}),
			appStarts: Effect.fn("AdminSetup.appStarts")(function* (ownerAccounts?: string) {
				story.tell(ownerAccounts === undefined ? "the app starts" : `the app starts with ${ownerAccounts} configured as owner`);
				engine.host = yield* startHost(ownerAccounts === undefined ? {} : { ownerAccounts });
			}),
			signedInAccount: () => signedInAccount(host().baseUrl, engine.cookie),
			signsIn: Effect.fn("AdminSetup.signsIn")(function* (email: string, password: string) {
				story.tell(`${email} signs in with a password`);
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
				return response.status === HttpStatus.fromLiteral("OK") ? "signed in" : `refused with HTTP ${response.status}`;
			}),
		};
	},
});

export const authTablesReady = adminSetup.trait("database", "the app's authentication tables exist", function* () {
	const steps = yield* migrationSteps({ ...migrations(), lockTimeout: "5 seconds" });
	yield* steps.migrateTo("0004_stored_roles");
});

export const aliceSignedInWithGitHub = adminSetup.trait(
	"accounts",
	"alice signed in with GitHub account 1001 before any owner was configured",
	function* (engine) {
		const { auth } = yield* betterAuthMount(
			{ ...authOptions(), database: yield* betterAuthDatabase(), plugins: [testUtils()], secret: Redacted.value(secret) },
			{ defaultRole: User.name, roles: AppAccess },
		).pipe(Effect.provide(ConfigProvider.layer(ConfigProvider.fromEnv({ env: {} }))));
		const session = yield* signedInUser(auth, {
			email: "alice@github.test",
			name: "alice",
			providerAccounts: [{ accountId: "1001", providerId: "github" }],
		});
		engine.cookie = session.headers.get("cookie") ?? "";
	},
);
