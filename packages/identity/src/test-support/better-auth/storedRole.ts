import { Effect } from "effect";
import { withIsolatedDatabase } from "@shivaedev/test-sql/server/withIsolatedDatabase.ts";
import { storyKit } from "@shivaedev/test-story/server/storyKit.ts";
import { databaseUrl, postgres } from "./postgres.ts";
import { roleHost } from "./roleHost.ts";

export const storedRole = storyKit({
	around: withIsolatedDatabase,
	clock: "live",
	create: () => roleHost(),
	layer: postgres,
	name: "stored session role",
	runIf: databaseUrl !== undefined,
	stages: ["session"],
	verbs: (host, story) => ({
		defectLogs: host.defectLogs,
		profile: () => {
			story.tell("alice requests her profile over RPC");
			return host.profile();
		},
		sessionStatus: () => {
			story.tell("alice requests her session through Better Auth's HTTP endpoint");
			return host.session().pipe(Effect.map((response) => response.status));
		},
	}),
});

export function signedInWithRole(role: string) {
	return storedRole.trait("session", `alice already has a stored session with role ${role}`, (host) => host.signedInAs(role));
}
