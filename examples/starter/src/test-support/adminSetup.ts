import { Effect } from "effect";
import { PostgresTestDatabase } from "@shivaedev/effect-test-sql/database.ts";
import { migrationUpgrade } from "@shivaedev/effect-test-sql/migrationUpgrade.ts";
import { withIsolatedDatabase } from "@shivaedev/effect-test-sql/withIsolatedDatabase.ts";
import { storyKit } from "@shivaedev/test-story/storyKit.ts";
import { authDatabase } from "#server/authDatabase.ts";
import { migrations } from "#server/migrations.ts";
import { type RunningHost, startHost } from "#test-support/host.ts";
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
			startApp: Effect.fn("AdminSetup.startApp")(function* () {
				story.tell("start the app after admin bootstrap");
				engine.host = yield* startHost();
			}),
			upgradeAuth: Effect.fn("AdminSetup.upgradeAuth")(function* () {
				story.tell("upgrade a database whose auth tables predate the admin plugin");
				const database = yield* PostgresTestDatabase;
				const pool = yield* authDatabase(database.url);
				yield* migrationUpgrade({ migrations: { ...migrations(pool), lockTimeout: "5 seconds" }, table: "user", upTo: 5 });
			}),
		};
	},
});
