import { Effect, Schema } from "effect";
import type { AccessPolicy } from "@shivaedev/access/roleSet.ts";
import { contract } from "@shivaedev/contract/contract.ts";
import { command, query } from "@shivaedev/contract/operation.ts";
import { AuthUnavailable, Forbidden, NotFound } from "@shivaedev/errors/taxonomy.ts";
import { LastRoleAssigner } from "@shivaedev/identity/roles.ts";
import { UserList, UserListInput, userKeys } from "@shivaedev/identity/users.ts";
import { adminPage } from "#page.ts";
import { UsersPermission } from "#permissions.ts";

export const UsersList = Schema.Struct({ ...UserList.fields, canChangeRoles: Schema.Boolean });
export function usersPage<const TRole extends string>(access: Pick<AccessPolicy<TRole>, "Role">) {
	return adminPage({
		contract: contract("admin.users", {
			commands: [
				command("changeRole", {
					invalidates: () => [userKeys.list],
					payload: { role: access.Role, userId: Schema.String },
					rejections: { AuthUnavailable, Forbidden, LastRoleAssigner, NotFound },
				}),
			],
			queries: [
				query("list", {
					payload: UserListInput.fields,
					readPolicy: () => Effect.succeed(true),
					reads: () => [userKeys.list],
					rejections: { AuthUnavailable, Forbidden },
					success: UsersList,
				}),
			],
		}),
		id: "users",
		permission: UsersPermission,
		route: { path: "/admin/users", title: "Users" },
	});
}
