import { Effect, Redacted } from "effect";
import { Migrator } from "effect/sql";
import { signedInUser } from "@shivaedev/identity/server/better-auth/testing.ts";
import { environmentVariable } from "@shivaedev/identity/test-support/environmentVariable.ts";
import { makePostgresTestLayer } from "@shivaedev/test-sql/server/postgres.ts";
import { withIsolatedDatabase } from "@shivaedev/test-sql/server/withIsolatedDatabase.ts";
import { storyKit } from "@shivaedev/test-story/server/storyKit.ts";
import { startAdminHost } from "./adminHost.ts";
import { adminVerbs } from "./adminVerbs.ts";

const databaseUrl = environmentVariable("PLATFORM_SQL_TEST_DATABASE_URL");

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
		const session = yield* Effect.promise(() => signedInUser(host.auth, { email: "member@example.test", ...(role === undefined ? {} : { role }) }));
		host.userId = session.user.id;
		host.headers = session.headers;
	});
}
