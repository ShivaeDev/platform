import { Schema } from "effect";
import { storyKit } from "@shivaedev/test-story/server/storyKit.ts";
import type { OwnPermission, Permission } from "#permission.ts";
import type { User } from "#roleSet.ts";
import { Access } from "./policy.ts";

interface AccessEngine {
	readonly access: typeof Access;
	user: User<typeof Access.Role.Type> | undefined;
}

export const accessStory = storyKit({
	create: (): AccessEngine => ({ access: Access, user: undefined }),
	name: "application access",
	stages: ["session"],
	verbs: (engine) => ({
		canAccess: (permission: OwnPermission, ownerId: string) => engine.access.canAccess(engine.user, permission, ownerId),
		decodeRole: (stored: unknown) => Schema.decodeUnknownEffect(engine.access.Role)(stored),
		hasPermission: (role: typeof Access.Role.Type, permission: Permission) => engine.access.hasPermission(role, permission),
		requireAccess: (permission: OwnPermission, ownerId: string) => engine.access.requireAccess(engine.user, permission, ownerId),
		requirePermission: (permission: Permission) => engine.access.requirePermission(engine.user, permission),
		resolve: (stored: unknown) => engine.access.resolve(stored),
	}),
});

export function signedIn(role: typeof Access.Role.Type, id = "alice") {
	return accessStory.trait("session", `${id} is already signed in as ${role}`, (engine) => {
		engine.user = { id, role };
	});
}
