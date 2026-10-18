import process from "node:process";
import { fileURLToPath } from "node:url";
import { NodeServices } from "@effect/platform-node";
import { Effect, Fiber, Redacted, Stream } from "effect";
import { ChildProcess, ChildProcessSpawner } from "effect/process";
import { PostgresTestDatabase } from "@shivaedev/effect-test-sql/database.ts";
import { migrationUpgrade } from "@shivaedev/effect-test-sql/migrationUpgrade.ts";
import { withIsolatedDatabase } from "@shivaedev/effect-test-sql/withIsolatedDatabase.ts";
import { storyKit } from "@shivaedev/test-story/storyKit.ts";
import { authDatabase } from "#server/authDatabase.ts";
import { migrations } from "#server/migrations.ts";
import { secret, startHost } from "#test-support/host.ts";
import { postgres } from "#test-support/postgres.ts";

export const adminSetup = storyKit({
	around: withIsolatedDatabase,
	clock: "live",
	create: () => ({}),
	layer: postgres,
	name: "admin setup",
	stages: ["database"],
	verbs: (_engine, story) => ({
		createAdmin: Effect.fn("AdminSetup.createAdmin")(function* (email: string, password: string) {
			story.tell(`run the admin bootstrap command for ${email}`);
			const database = yield* PostgresTestDatabase;
			return yield* Effect.gen(function* () {
				const spawner = yield* ChildProcessSpawner.ChildProcessSpawner;
				const child = yield* spawner.spawn(
					ChildProcess.make(process.execPath, ["--conditions=source", fileURLToPath(new URL("../server/admin.ts", import.meta.url))], {
						env: {
							"ADMIN_EMAIL": email,
							"ADMIN_PASSWORD": password,
							"BETTER_AUTH_SECRET": Redacted.value(secret),
							"DATABASE_URL": Redacted.value(database.url),
						},
						extendEnv: false,
					}),
				);
				const output = yield* child.stdout.pipe(Stream.decodeText(), Stream.runCollect, Effect.forkScoped);
				const errors = yield* child.stderr.pipe(Stream.decodeText(), Stream.runCollect, Effect.forkScoped);
				const code = yield* child.exitCode;
				return { code, errors: (yield* Fiber.join(errors)).join(""), output: (yield* Fiber.join(output)).join("") };
			}).pipe(Effect.provide(NodeServices.layer));
		}),
		signIn: Effect.fn("AdminSetup.signIn")(function* (email: string, password: string) {
			story.tell(`sign in to the app as ${email} and read the session`);
			const host = yield* startHost();
			const response = yield* Effect.promise(() =>
				fetch(`${host.baseUrl}/api/auth/sign-in/email`, {
					body: JSON.stringify({ email, password }),
					headers: { "content-type": "application/json", origin: host.origin },
					method: "POST",
				}),
			);
			yield* Effect.promise(() => response.text());
			const cookie = response.headers
				.getSetCookie()
				.map((value) => value.split(";")[0])
				.join("; ");
			const session = yield* Effect.promise(() => fetch(`${host.baseUrl}/api/auth/get-session`, { headers: { cookie } }));
			const body: unknown = yield* Effect.promise(() => session.json());
			return { body, status: response.status };
		}),
		upgradeAuth: Effect.fn("AdminSetup.upgradeAuth")(function* () {
			story.tell("upgrade a database whose auth tables predate the admin plugin");
			const database = yield* PostgresTestDatabase;
			const pool = yield* authDatabase(database.url);
			yield* migrationUpgrade({ migrations: { ...migrations(pool), lockTimeout: "5 seconds" }, table: "user", upTo: 5 });
		}),
	}),
});
