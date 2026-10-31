import { databaseUrl, postgres } from "@shivaedev/test-sql/server/emptyPostgres.ts";
import { withIsolatedDatabase } from "@shivaedev/test-sql/server/withIsolatedDatabase.ts";
import { storyKit } from "@shivaedev/test-story/server/storyKit.ts";
import { type Person, roleAdoptionHost } from "./roleAdoptionHost.ts";

export const roleAdoption = storyKit({
	around: withIsolatedDatabase,
	clock: "live",
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
		storedRoles: host.storedRoles,
	}),
});

export const beforeRoles = roleAdoption.trait("schema", "the user table has no role field", (host) => host.createSchema());
export const freshRoles = roleAdoption.trait("schema", "a fresh database has stored roles", (host) => host.createSchema("member"));
export const existingUsers = roleAdoption.trait("users", "alice and bob already have users and sessions", function* (host) {
	yield* host.mint("alice");
	yield* host.mint("bob");
});
