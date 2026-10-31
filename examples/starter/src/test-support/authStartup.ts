import { betterAuth } from "better-auth";
import { Effect, Redacted } from "effect";
import { betterAuthDatabase } from "@shivaedev/identity/server/better-auth/adapters/database.ts";
import { PostgresTestDatabase } from "@shivaedev/test-sql/server/database.ts";
import { withIsolatedDatabase } from "@shivaedev/test-sql/server/withIsolatedDatabase.ts";
import { storyKit } from "@shivaedev/test-story/server/storyKit.ts";
import { readyAuth } from "#server/adapters/readyAuth.ts";
import { authOptions } from "#server/authOptions.ts";
import { migrateDatabase } from "#server/migrateDatabase.ts";
import { secret } from "./host.ts";
import { postgres } from "./postgres.ts";

export const authStartup = storyKit({
	around: withIsolatedDatabase,
	clock: "live",
	*create() {
		const database = yield* PostgresTestDatabase;
		yield* Effect.scoped(migrateDatabase(database.url));
		return { validation: "not started" };
	},
	layer: postgres,
	name: "authentication startup",
	stages: [],
	verbs: (engine) => ({
		closeAuthenticationScope: Effect.fn("AuthStartupStory.closeAuthenticationScope")(function* () {
			const pending = yield* Effect.scoped(
				Effect.gen(function* () {
					const database = yield* betterAuthDatabase();
					const auth = betterAuth({ ...authOptions(), "baseURL": "http://localhost:3000", database, secret: Redacted.value(secret) });
					const context = yield* Effect.promise(() => auth.$context);
					if (context.checkSchema === undefined) {
						return yield* Effect.die("The PostgreSQL auth adapter must provide schema validation");
					}
					const validation = context.checkSchema();
					yield* readyAuth(auth);
					return { validation };
				}),
			);
			engine.validation = yield* Effect.tryPromise(() => pending.validation ?? Promise.resolve()).pipe(
				Effect.match({ onFailure: () => "failed", onSuccess: () => "completed" }),
			);
		}),
		schemaValidation: () => Effect.sync(() => engine.validation),
	}),
});
