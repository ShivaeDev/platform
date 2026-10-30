import { Effect, Schema } from "effect";
import type { AccessPolicy } from "@shivaedev/access/roleSet.ts";
import { collection } from "@shivaedev/changes/keys.ts";
import { contract } from "@shivaedev/contract/contract.ts";
import { command, query } from "@shivaedev/contract/operation.ts";
import { AuthUnavailable, Forbidden, NotFound } from "@shivaedev/errors/taxonomy.ts";
import { SessionUser } from "@shivaedev/identity/identity.ts";
import { hasPermission } from "@shivaedev/identity/permission.ts";
import { adminPage } from "#page.ts";
import { UsersPermission } from "#permissions.ts";
import { LastRoleAssigner, UserList, UserListInput } from "#users/roles.ts";

const users = collection("admin.users", Schema.String);

export const UsersList = Schema.Struct({ ...UserList.fields, canChangeRoles: Schema.Boolean });
export function usersPage<const TRole extends string>(access: Pick<AccessPolicy<TRole>, "Role">) {
	return adminPage({
		contract: contract("admin.users", {
			commands: [
				command("changeRole", {
					invalidates: () => [users.list],
					payload: { role: access.Role, userId: Schema.String },
					rejections: { AuthUnavailable, Forbidden, LastRoleAssigner, NotFound },
				}),
			],
			queries: [
				query("list", {
					payload: UserListInput.fields,
					readPolicy: () => Effect.map(SessionUser, (user) => hasPermission(user, UsersPermission.permission)),
					reads: () => [users.list],
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
