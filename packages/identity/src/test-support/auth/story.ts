import { Effect } from "effect";
import { databaseUrl, postgres } from "@shivaedev/test-sql/server/emptyPostgres.ts";
import { withIsolatedDatabase } from "@shivaedev/test-sql/server/withIsolatedDatabase.ts";
import { storyKit } from "@shivaedev/test-story/server/storyKit.ts";
import { signedInUser } from "#server/better-auth/testing.ts";
import { startAdminHost } from "./adminHost.ts";
import { adminVerbs } from "./adminVerbs.ts";

export const auth = storyKit({
	around: withIsolatedDatabase,
	clock: "live",
	*create() {
		return yield* startAdminHost;
	},
	layer: postgres,
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
