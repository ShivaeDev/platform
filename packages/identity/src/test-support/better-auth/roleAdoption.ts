import { Effect } from "effect";
import { storyKit } from "@shivaedev/test-story/server/storyKit.ts";
import { type Person, roleAdoptionHost } from "#test/better-auth/roleAdoptionHost.ts";
import { storyClock, withIdentityDatabase } from "#test/clock.ts";
import { databaseUrl, postgres } from "#test/postgres.ts";

export const roleAdoption = storyKit({
	around: withIdentityDatabase,
	clock: storyClock,
	create: () => roleAdoptionHost(),
	layer: postgres,
	name: "stored role adoption",
	runIf: databaseUrl !== undefined,
	stages: ["schema", "users"],
	verbs: (host, story) => ({
		assignAdmin: (name: Person) => {
			story.tell(`assign ${name} the first admin role`);
			return host.assignAdmin(name);
		},
		createFreshSchema: () => {
			story.tell("create stored roles in a separate fresh database");
			return host.createFreshSchema();
		},
		freshRoleColumn: host.freshRoleColumn,
		migrateRoles: () => {
			story.tell("adopt stored roles with member as the default");
			return host.createSchema("member");
		},
		removeRole: (name: Person) => {
			story.tell(`${name} has a null role in a partially migrated database`);
			return host.removeRole(name);
		},
		roleColumn: host.roleColumn,
		sessionRole: host.sessionRole,
		signUp: (name: Person) => {
			story.tell(`${name} signs up while requesting the admin role`);
			return host.signUp(name);
		},
		start: (defaultRole: string) => {
			story.tell(`start the auth host with ${defaultRole} as its default role`);
			return host.start(defaultRole).pipe(
				Effect.as("started"),
				Effect.catchTag("UndeclaredDefaultRole", (error) => Effect.succeed(error.message)),
			);
		},
		storedRoles: host.storedRoles,
	}),
});

export const beforeRoles = roleAdoption.trait("schema", "the user table has no role field", (host) => host.createSchema());
export const freshRoles = roleAdoption.trait("schema", "a fresh database has stored roles", (host) => host.createSchema("member"));
export const existingUsers = roleAdoption.trait("users", "alice and bob already have users and sessions", function* (host) {
	yield* host.mint("alice");
	yield* host.mint("bob");
});
