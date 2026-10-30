import { Effect } from "effect";
import type { AccessPolicy } from "@shivaedev/access/roleSet.ts";
import { SessionUser } from "@shivaedev/identity/identity.ts";
import { hasPermission } from "@shivaedev/identity/permission.ts";
import { AssignRoles } from "#permissions.ts";
import { changeUserRole, listUsers } from "#server/users.ts";
import type { usersPage } from "#users/page.ts";

export function usersHandlers<const TRole extends string>(
	page: ReturnType<typeof usersPage<TRole>>,
	access: Pick<AccessPolicy<TRole>, "Role" | "hasPermission">,
) {
	return page.contract.application.toLayer({
		"admin.users.changeRole": (input) => changeUserRole(access, input),
		"admin.users.list": (input) =>
			Effect.gen(function* () {
				const user = yield* SessionUser;
				return { ...(yield* listUsers(access, input)), canChangeRoles: hasPermission(user, AssignRoles) };
			}),
	});
}
