import { Effect } from "effect";
import { SessionUser } from "@shivaedev/identity/identity.ts";
import { hasPermission } from "@shivaedev/identity/permission.ts";
import { AssignRoles } from "@shivaedev/identity/roles.ts";
import { changeUserRole, listUsers } from "#server/users.ts";
import type { usersPage } from "#users/page.ts";

export function usersHandlers<const TRole extends string>(page: ReturnType<typeof usersPage<TRole>>) {
	return page.contract.application.toLayer({
		"admin.users.changeRole": (input) => changeUserRole(input),
		"admin.users.list": (input) =>
			Effect.gen(function* () {
				const user = yield* SessionUser;
				return { ...(yield* listUsers(input)), canChangeRoles: hasPermission(user, AssignRoles) };
			}),
	});
}
