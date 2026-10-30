import { betterAuth } from "better-auth";
import { getMigrations } from "better-auth/db/migration";
import { testUtils } from "better-auth/plugins";
import { Effect, Schema } from "effect";
import { PostgresTestDatabase } from "@shivaedev/test-sql/server/database.ts";
import { withIsolatedDatabase } from "@shivaedev/test-sql/server/withIsolatedDatabase.ts";
import { storyKit } from "@shivaedev/test-story/server/storyKit.ts";
import { authDatabase } from "#server/better-auth/mount.ts";
import { passwordUser } from "#server/better-auth/testing.ts";
import { postgres } from "./postgres.ts";

const ORIGIN = "http://localhost:3000";
const credentials = { email: "ada@password.test", password: "correct-horse-battery-staple" };
const SessionBody = Schema.Struct({ user: Schema.Struct({ email: Schema.String, name: Schema.String }) });

export const passwordAuth = storyKit({
	around: withIsolatedDatabase,
	clock: "live",
	*create() {
		const database = yield* PostgresTestDatabase;
		const options = {
			"baseURL": ORIGIN,
			database: yield* authDatabase(database.url),
			emailAndPassword: { enabled: true },
			logger: { disabled: true },
			plugins: [testUtils()],
			secret: "password-story-secret-with-at-least-32-characters",
		};
		yield* Effect.promise(async () => (await getMigrations(options)).runMigrations());
		return { auth: betterAuth(options), cookie: "" };
	},
	layer: postgres,
	name: "password user",
	stages: ["account"],
	verbs: (engine, story) => ({
		session: () =>
			Effect.promise(async () => {
				const response = await engine.auth.handler(new Request(`${ORIGIN}/api/auth/get-session`, { headers: { cookie: engine.cookie } }));
				const body = await response.json();
				return body === null ? "signed out" : Schema.decodeUnknownSync(SessionBody)(body).user;
			}),
		signIn: () =>
			Effect.promise(async () => {
				story.tell("ada signs in through the email route with her password");
				const response = await engine.auth.handler(
					new Request(`${ORIGIN}/api/auth/sign-in/email`, {
						body: JSON.stringify(credentials),
						headers: { "content-type": "application/json", origin: ORIGIN },
						method: "POST",
					}),
				);
				await response.text();
				engine.cookie = response.headers
					.getSetCookie()
					.map((cookie) => cookie.split(";")[0])
					.join("; ");
				return response.status;
			}),
	}),
});

export const adaPassword = passwordAuth.trait("account", "ada has a password account and is signed out", (engine) =>
	passwordUser(engine.auth, { ...credentials, name: "ada" }).pipe(Effect.asVoid),
);
