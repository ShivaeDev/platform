import { Effect, Redacted } from "effect";
import { Migrator } from "effect/sql";
import { makePostgresTestLayer } from "@shivaedev/effect-test-sql/postgres.ts";
import { withIsolatedDatabase } from "@shivaedev/effect-test-sql/withIsolatedDatabase.ts";
import { storyKit } from "@shivaedev/test-story/storyKit.ts";
import { environmentVariable } from "#test/environmentVariable.ts";
import { startAdminHost } from "./adminHost.ts";
import { adminVerbs } from "./adminVerbs.ts";

const databaseUrl = environmentVariable("PLATFORM_EFFECT_SQL_TEST_DATABASE_URL");

export const auth = storyKit({
	around: withIsolatedDatabase,
	clock: "live",
	*create() {
		return yield* startAdminHost;
	},
	layer: makePostgresTestLayer({
		migrations: { loader: Migrator.fromRecord({}), lockTimeout: "5 seconds" },
		url: Redacted.make(databaseUrl ?? "postgresql://integration-tests-disabled"),
	}),
	name: "auth",
	runIf: databaseUrl !== undefined,
	stages: ["session"],
	verbs: adminVerbs,
});

export function signedInWithRole(role?: string) {
	return auth.trait("session", `a session is minted for a user with role ${role ?? "unset"}`, function* (host) {
		// Better Auth's test helper mints the signed-in precondition without hashing a password.
		const { test } = yield* Effect.promise(() => host.auth.$context);
		const user = yield* Effect.promise(() =>
			test.saveUser(test.createUser({ email: "member@example.test", ...(role === undefined ? {} : { role }) })),
		);
		host.userId = user.id;
		host.headers = yield* Effect.promise(() => test.getAuthHeaders({ userId: user.id }));
	});
}
