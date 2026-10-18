import { Config, Effect, Layer } from "effect";
import { Migrator } from "effect/sql";
import { makePostgresTestLayer } from "@shivaedev/effect-test-sql/postgres.ts";
import { withIsolatedDatabase } from "@shivaedev/effect-test-sql/withIsolatedDatabase.ts";
import { storyKit } from "@shivaedev/test-story/storyKit.ts";
import { startAdminHost } from "./adminHost.ts";
import { adminVerbs } from "./adminVerbs.ts";

export const auth = storyKit({
	around: withIsolatedDatabase,
	clock: "live",
	*create() {
		return yield* startAdminHost;
	},
	layer: Layer.unwrap(
		Effect.map(Config.Redacted("PLATFORM_EFFECT_SQL_TEST_DATABASE_URL"), (url) =>
			makePostgresTestLayer({ migrations: { loader: Migrator.fromRecord({}), lockTimeout: "5 seconds" }, url }),
		),
	),
	name: "auth",
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
