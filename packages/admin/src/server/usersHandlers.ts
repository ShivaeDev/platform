import { Effect } from "effect";
import { hasRole } from "@shivaedev/platform/rpc/hasRole.ts";
import { SessionUser } from "@shivaedev/platform/rpc/identity.ts";
import { changeUserRole, listUsers } from "@shivaedev/platform/server/better-auth/users.ts";
import { UsersPage } from "#users/page.ts";

export const usersHandlers = UsersPage.contract.application.toLayer({
	"admin.users.changeRole": changeUserRole,
	"admin.users.list": (input) =>
		Effect.gen(function* () {
			const user = yield* SessionUser;
			return { ...(yield* listUsers(input)), canChangeRoles: hasRole(user, "owner") };
		}),
});
