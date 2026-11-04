import { signedInUser } from "@shivaedev/test-kits/identity/adapters/betterAuth.ts";
import { databaseUrl, postgres } from "@shivaedev/test-sql/server/emptyPostgres.ts";
import { storyKit } from "@shivaedev/test-story/server/storyKit.ts";
import { storyClock, withIdentityDatabase } from "#test/clock.ts";
import { startAdminHost } from "./adminHost.ts";
import { adminVerbs } from "./adminVerbs.ts";

export const auth = storyKit({
	around: withIdentityDatabase,
	clock: storyClock,
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
		const session = yield* signedInUser(host.auth, { email: "member@example.test", ...(role === undefined ? {} : { role }) });
		host.userId = session.user.id;
		host.headers = session.headers;
	});
}
