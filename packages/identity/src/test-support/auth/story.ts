import { mintUser, signedInUser } from "@shivaedev/test-kits/identity/adapters/betterAuth.ts";
import { storyKit } from "@shivaedev/test-story/server/storyKit.ts";
import { startAdminHost } from "#test/auth/adminHost.ts";
import { adminVerbs } from "#test/auth/adminVerbs.ts";
import type { TestRoles } from "#test/auth/permissions.ts";
import { storyClock, withIdentityDatabase } from "#test/clock.ts";
import { databaseUrl, postgres } from "#test/postgres.ts";

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

export function mintedWithRole(role: typeof TestRoles.Role.Type) {
	return auth.trait("session", `ada is minted with role ${role} from the host's auth declaration`, function* (host) {
		const session = yield* mintUser(host.declaration, { origin: host.baseUrl }, "ada", { role });
		host.userId = session.user.id;
		host.headers = session.headers;
	});
}
