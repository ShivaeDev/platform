import { DateTime, Effect, Redacted } from "effect";
import { betterAuthDatabase } from "@shivaedev/identity/server/better-auth/adapters/database.ts";
import { betterAuthMount } from "@shivaedev/identity/server/better-auth/adapters/mount.ts";
import { memoryStore } from "@shivaedev/rate-limit/memoryStore.ts";
import { withIsolatedDatabase } from "@shivaedev/test-sql/server/withIsolatedDatabase.ts";
import { storyKit } from "@shivaedev/test-story/server/storyKit.ts";
import { authOptions } from "#server/authOptions.ts";
import { secret } from "#test-support/host.ts";
import { configured, postgres } from "#test-support/postgres.ts";

export const authStartup = storyKit({
	around: withIsolatedDatabase,
	clock: Effect.runSync(DateTime.now),
	create: () => ({ validation: "not started" }),
	layer: postgres,
	name: "authentication startup",
	runIf: configured,
	stages: [],
	verbs: (engine) => ({
		closeAuthenticationScope: Effect.fn("AuthStartupStory.closeAuthenticationScope")(function* () {
			yield* Effect.scoped(
				Effect.gen(function* () {
					const database = yield* betterAuthDatabase();
					const { auth } = yield* betterAuthMount({
						...authOptions(),
						"baseURL": "http://localhost:3000",
						database,
						secret: Redacted.value(secret),
					}).pipe(Effect.provide(memoryStore));
					const context = yield* Effect.promise(() => auth.$context);
					if (context.checkSchema === undefined) {
						return yield* Effect.die("The PostgreSQL auth adapter must provide schema validation");
					}
					const validation = context.checkSchema();
					engine.validation = validation === undefined ? "completed" : "pending";
					if (validation !== undefined) {
						yield* Effect.tryPromise(() => validation);
					}
				}),
			);
		}),
		schemaValidation: () => Effect.sync(() => engine.validation),
	}),
});
