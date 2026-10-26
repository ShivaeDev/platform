import { Effect } from "effect";
import { SessionUser } from "@shivaedev/identity/identity.ts";
import { hasPermission } from "@shivaedev/identity/permission.ts";
import { ChangeUserRoles } from "@shivaedev/platform/rpc/userRoles.ts";
import { changeUserRole, listUsers } from "@shivaedev/platform/server/better-auth/users.ts";
import { UsersPage } from "#users/page.ts";

export const usersHandlers = UsersPage.contract.application.toLayer({
	"admin.users.changeRole": changeUserRole,
	"admin.users.list": (input) =>
		Effect.gen(function* () {
			const user = yield* SessionUser;
			return { ...(yield* listUsers(input)), canChangeRoles: hasPermission(user, ChangeUserRoles) };
		}),
});
