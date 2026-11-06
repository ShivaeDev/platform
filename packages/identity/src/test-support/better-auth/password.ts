import { betterAuth } from "better-auth";
import { getMigrations } from "better-auth/db/migration";
import { Effect, Redacted, Schema } from "effect";
import { Migrator, SqlClient } from "effect/sql";
import { passwordUser } from "@shivaedev/test-kits/identity/adapters/betterAuth.ts";
import { makePostgresTestLayer } from "@shivaedev/test-sql/server/postgres.ts";
import { storyKit } from "@shivaedev/test-story/server/storyKit.ts";
import { SessionUserSchema } from "#identity.ts";
import { betterAuthDatabase } from "#server/better-auth/adapters/database.ts";
import { storyClock, withIdentityDatabase } from "#test/clock.ts";
import { PASSWORD_HASH } from "#test/passwords.ts";
import { databaseUrl } from "#test/postgres.ts";

const ORIGIN = "http://localhost:3000";
const credentials = { email: "ada@password.test", password: "correct-horse-battery-staple" };
const SessionBody = Schema.Struct({ user: SessionUserSchema });

const postgres = makePostgresTestLayer({
	maxConnections: 1,
	migrations: { loader: Migrator.fromRecord({}), lockTimeout: "5 seconds" },
	url: Redacted.make(databaseUrl ?? "postgresql://integration-tests-disabled"),
});

export const passwordAuth = storyKit({
	around: withIdentityDatabase,
	clock: storyClock,
	*create() {
		const options = {
			"baseURL": ORIGIN,
			database: yield* betterAuthDatabase(),
			emailAndPassword: { enabled: true },
			logger: { disabled: true },
			secret: "password-story-secret-with-at-least-32-characters",
		};
		yield* Effect.promise(async () => (await getMigrations(options)).runMigrations());
		return { auth: betterAuth(options), cookie: "" };
	},
	layer: postgres,
	name: "password user",
	runIf: databaseUrl !== undefined,
	stages: ["account"],
	verbs: (engine, story) => ({
		databaseConnections: () =>
			Effect.gen(function* () {
				const sql = yield* SqlClient.SqlClient;
				const rows = yield* sql<{
					connections: number;
				}>`select count(*)::int as connections from pg_stat_activity where datname = current_database()`;
				return rows.map(({ connections }) => connections);
			}),
		session: () =>
			Effect.promise(async () => {
				const response = await engine.auth.handler(new Request(`${ORIGIN}/api/auth/get-session`, { headers: { cookie: engine.cookie } }));
				const body = await response.json();
				if (body === null) {
					return "signed out";
				}
				const { email, name } = Schema.decodeUnknownSync(SessionBody)(body).user;
				return { email, name };
			}),
		signIn: (password = credentials.password) =>
			Effect.promise(async () => {
				story.tell("ada signs in through the email route with her password");
				const response = await engine.auth.handler(
					new Request(`${ORIGIN}/api/auth/sign-in/email`, {
						body: JSON.stringify({ ...credentials, password }),
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

export const adaPrecomputedPassword = passwordAuth.trait("account", "ada has a precomputed password credential and is signed out", (engine) =>
	passwordUser(engine.auth, { email: credentials.email, name: "ada", passwordHash: PASSWORD_HASH }).pipe(Effect.asVoid),
);
