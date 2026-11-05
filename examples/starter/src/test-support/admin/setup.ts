import { fileURLToPath } from "node:url";
import * as NodeServices from "@effect/platform-node/NodeServices";
import { testUtils } from "better-auth/plugins";
import { ConfigProvider, DateTime, Effect, Redacted } from "effect";
import * as HttpStatus from "effect/http/HttpStatus";
import { ChildProcess, ChildProcessSpawner } from "effect/process";
import { betterAuthDatabase } from "@shivaedev/identity/server/better-auth/adapters/database.ts";
import { betterAuthMount } from "@shivaedev/identity/server/better-auth/adapters/mount.ts";
import { memoryStore } from "@shivaedev/rate-limit/memoryStore.ts";
import { signedInUser } from "@shivaedev/test-kits/identity/adapters/betterAuth.ts";
import { PostgresTestDatabase } from "@shivaedev/test-sql/server/database.ts";
import { withIsolatedDatabase } from "@shivaedev/test-sql/server/withIsolatedDatabase.ts";
import { storyKit } from "@shivaedev/test-story/server/storyKit.ts";
import { AppAccess } from "#AppAccess.ts";
import { User } from "#roles/User.ts";
import { authOptions } from "#server/authOptions.ts";
import { type RunningHost, secret, startHost } from "#test-support/host.ts";
import { configured, postgres } from "#test-support/postgres.ts";
import { adminCommand } from "./command.ts";
import { signedInAccount } from "./session.ts";

interface Engine {
	cookie: string;
	host: RunningHost | undefined;
}

export const adminSetup = storyKit({
	clock: Effect.runSync(DateTime.now),
	around: withIsolatedDatabase,
	create: (): Engine => ({ cookie: "", host: undefined }),
	inspect: ({ host }) => ({ baseUrl: host?.baseUrl }),
	layer: postgres,
	name: "admin setup",
	runIf: configured,
	stages: ["accounts"],
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
			seedCommandRuns: () =>
				Effect.gen(function* () {
					story.tell("the app runs pnpm db:seed");
					const database = yield* PostgresTestDatabase;
					const spawner = yield* ChildProcessSpawner.ChildProcessSpawner;
					return yield* spawner.exitCode(
						ChildProcess.make("pnpm", ["db:seed"], {
							cwd: fileURLToPath(new URL("../../../", import.meta.url)),
							env: { "BETTER_AUTH_SECRET": Redacted.value(secret), "DATABASE_URL": Redacted.value(database.url) },
							extendEnv: true,
							stderr: "inherit",
							stdout: "inherit",
						}),
					);
				}).pipe(Effect.provide(NodeServices.layer)),
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

export const aliceSignedInWithGitHub = adminSetup.trait(
	"accounts",
	"alice signed in with GitHub account 1001 before any owner was configured",
	function* (engine) {
		const { auth } = yield* betterAuthMount(
			{ ...authOptions(), database: yield* betterAuthDatabase(), plugins: [testUtils()], secret: Redacted.value(secret) },
			{ defaultRole: User.name, roles: AppAccess },
		)
			.pipe(Effect.provide(memoryStore))
			.pipe(Effect.provide(ConfigProvider.layer(ConfigProvider.fromEnv({ env: {} }))));
		const session = yield* signedInUser(auth, {
			email: "alice@github.test",
			name: "alice",
			providerAccounts: [{ accountId: "1001", providerId: "github" }],
		});
		engine.cookie = session.headers.get("cookie") ?? "";
	},
);
