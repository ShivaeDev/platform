import { Effect } from "effect";
import type { AccessPolicy } from "@shivaedev/access/roleSet.ts";
import { AssignRoles } from "@shivaedev/access/roles.ts";
import { SessionUser } from "@shivaedev/identity/identity.ts";
import { hasPermission } from "@shivaedev/identity/permission.ts";
import type { AuthTableOptions } from "@shivaedev/identity/server/better-auth/tables.ts";
import { changeUserRole, listUsers } from "#server/users.ts";
import type { usersPage } from "#users/page.ts";

export function usersHandlers<const TRole extends string>(
	page: ReturnType<typeof usersPage<TRole>>,
	access: Pick<AccessPolicy<TRole>, "Role" | "hasPermission">,
	options?: AuthTableOptions,
) {
	return page.contract.application.toLayer({
		"admin.users.changeRole": (input) => changeUserRole(access, input, options),
		"admin.users.list": (input) =>
			Effect.gen(function* () {
				const user = yield* SessionUser;
				return { ...(yield* listUsers(access, input, options)), canChangeRoles: hasPermission(user, AssignRoles) };
			}),
	});
}
