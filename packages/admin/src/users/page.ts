import { Effect, Schema } from "effect";
import type { AccessPolicy } from "@shivaedev/access/roleSet.ts";
import { LastRoleAssigner } from "@shivaedev/access/roles.ts";
import { collection } from "@shivaedev/changes/keys.ts";
import { contract } from "@shivaedev/contract/contract.ts";
import { command, query } from "@shivaedev/contract/operation.ts";
import { AuthUnavailable, Forbidden, NotFound } from "@shivaedev/errors/taxonomy.ts";
import { adminPage } from "#page.ts";
import { UsersPermission } from "#permissions.ts";
import { UserList, UserListInput } from "#users/roles.ts";

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
					readPolicy: () => Effect.succeed(true),
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
