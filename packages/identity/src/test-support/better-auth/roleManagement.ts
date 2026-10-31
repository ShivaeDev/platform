import { Effect } from "effect";
import * as Reactivity from "effect/reactivity/Reactivity";
import { databaseUrl, postgres } from "@shivaedev/test-sql/server/emptyPostgres.ts";
import { withIsolatedDatabase } from "@shivaedev/test-sql/server/withIsolatedDatabase.ts";
import { storyKit } from "@shivaedev/test-story/server/storyKit.ts";
import { type ManagedRole, type Person, type RoleActor, roleManagementHost } from "./roleManagementHost.ts";

export const roleManagement = storyKit({
	around: withIsolatedDatabase,
	clock: "live",
	create: () => roleManagementHost().pipe(Effect.provide(Reactivity.layer)),
	layer: postgres,
	name: "framework role management",
	runIf: databaseUrl !== undefined,
	stages: [],
	verbs: (host, story) => ({
		changeOnUsersPage: (person: Person, role: ManagedRole) => {
			story.tell(`alice assigns ${role} to ${person} through the users page RPC`);
			return host.changeOnUsersPage(person, role);
		},
		requestRoleEndpoint: (actor: RoleActor, endpoint: "set-role" | "update-user" | "create-user") => {
			story.tell(`${actor} tries to change a role through /admin/${endpoint}`);
			const bodies = {
				"create-user": { email: "carol@roles.test", name: "carol", role: "admin" },
				"set-role": { role: "user", userId: host.userId("alice") },
				"update-user": { data: { role: "user" }, userId: host.userId("alice") },
			};
			return host.request(actor, `/admin/${endpoint}`, bodies[endpoint]).pipe(Effect.map((response) => response.status));
		},
		rolesOnUsersPage: host.rolesOnUsersPage,
		seedRole: (person: Person, role: ManagedRole) => {
			story.tell(`an operator seed assigns ${role} to ${person} through identity`);
			return host.seedRole(person, role);
		},
		sessionRole: host.sessionRole,
		updateProfile: () => {
			story.tell("alice requests the profile endpoint disabled by the app");
			return host.request("alice", "/update-user", { name: "changed" }).pipe(Effect.map((response) => response.status));
		},
	}),
});
