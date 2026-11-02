import { DateTime, Effect } from "effect";
import { requirePermission } from "@shivaedev/access/requirePermission.ts";
import { SessionUser } from "@shivaedev/identity/identity.ts";
import { AssignRoles } from "@shivaedev/identity/roles.ts";
import { UserDirectory } from "@shivaedev/identity/server/UserDirectory.ts";
import type { UserListInput } from "@shivaedev/identity/users.ts";
import { ReadUsers } from "#permissions.ts";
import type { ChangeRoleInput } from "#users/ChangeRoleInput.ts";

export const listUsers = Effect.fn("Admin.listUsers")(function* (input: typeof UserListInput.Type) {
	yield* requirePermission(yield* SessionUser, ReadUsers);
	return yield* (yield* UserDirectory).list(input);
});

export const changeUserRole = Effect.fn("Admin.changeUserRole")(function* (input: ChangeRoleInput) {
	const actor = yield* SessionUser;
	yield* requirePermission(actor, AssignRoles);
	const changed = yield* (yield* UserDirectory).assignRole(input.userId, input.role);
	if (changed) {
		const changedAt = DateTime.formatIso(yield* DateTime.now);
		yield* Effect.logInfo("User role changed").pipe(Effect.annotateLogs({ actorId: actor.id, changedAt, ...input }));
	}
});
