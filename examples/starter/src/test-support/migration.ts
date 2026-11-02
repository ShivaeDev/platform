import { testUtils } from "better-auth/plugins";
import { Effect } from "effect";
import { betterAuthDatabase } from "@shivaedev/identity/server/better-auth/adapters/database.ts";
import { assertBetterAuthSchema } from "@shivaedev/identity/server/better-auth/assertSchema.ts";
import { betterAuthMount } from "@shivaedev/identity/server/better-auth/mount.ts";
import { authTestDatabase } from "@shivaedev/identity/server/better-auth/testDatabase.ts";
import { signedInUser } from "@shivaedev/identity/server/better-auth/testing.ts";
import { memoryStore } from "@shivaedev/rate-limit/memoryStore.ts";
import { answered } from "@shivaedev/test/answers.ts";
import { migrationSteps } from "@shivaedev/test-sql/server/migrationSteps.ts";
import { withIsolatedDatabase } from "@shivaedev/test-sql/server/withIsolatedDatabase.ts";
import { storyKit } from "@shivaedev/test-story/server/storyKit.ts";
import { User } from "#roles/User.ts";
import { authOptions } from "#server/authOptions.ts";
import { migrations } from "#server/migrations.ts";
import { postgres } from "#test-support/postgres.ts";

export const migration = storyKit({
	around: withIsolatedDatabase,
	clock: "live",
	*create() {
		const steps = yield* migrationSteps({ ...migrations(), lockTimeout: "5 seconds" });
		return { steps, storage: yield* authTestDatabase };
	},
	layer: postgres,
	name: "app authentication schema",
	stages: ["schema"],
	verbs: (engine, story) => ({
		authSchemaCheck: () => answered(Effect.as(assertBetterAuthSchema(authOptions(), { defaultRole: User.name }), "accepted")),
		migrates: Effect.fn("AppStory.migrates")(function* () {
			story.tell("every numbered application migration runs");
			yield* engine.steps.migrateToLatest;
		}),
		roleColumn: Effect.fn("AppStory.roleColumn")(function* () {
			const [column] = yield* engine.storage.roleColumn;
			if (column === undefined) {
				return "missing";
			}
			return [
				column.type,
				column.nullable === "NO" ? "not null" : "nullable",
				column.default === null ? "no default" : `default ${column.default.replace(/::text$/v, "")}`,
			].join(", ");
		}),
		rolesMigrationRuns: () => {
			story.tell("the stored-roles migration runs");
			return engine.steps.migrateTo("0004_stored_roles");
		},
		storedRoles: () => engine.storage.userRoles,
	}),
});

export const legacyUser = migration.trait("schema", "alice has a user before roles are required", function* (engine) {
	yield* engine.steps.migrateTo("0001_auth");
	const { auth } = yield* betterAuthMount({
		advanced: { database: { validateSchema: true } },
		database: yield* betterAuthDatabase(),
		emailAndPassword: { enabled: true },
		plugins: [testUtils()],
		secret: "migration-story-secret-at-least-32-characters",
		session: { cookieCache: { enabled: false } },
	}).pipe(Effect.provide(memoryStore));
	yield* signedInUser(auth, { email: "alice@migration.test", name: "alice" });
});
