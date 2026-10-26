import { Effect } from "effect";
import { SessionUser } from "@shivaedev/identity/identity.ts";
import { hasPermission } from "@shivaedev/identity/permission.ts";
import { changeUserRole, listUsers } from "#server/users.ts";
import { UsersPage } from "#users/page.ts";
import { ChangeUserRoles } from "#users/roles.ts";

export const usersHandlers = UsersPage.contract.application.toLayer({
	"admin.users.changeRole": changeUserRole,
	"admin.users.list": (input) =>
		Effect.gen(function* () {
			const user = yield* SessionUser;
			return { ...(yield* listUsers(input)), canChangeRoles: hasPermission(user, ChangeUserRoles) };
		}),
});
