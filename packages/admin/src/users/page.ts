import { Schema } from "effect";
import { contract } from "@shivaedev/contract/contract.ts";
import { collection } from "@shivaedev/contract/keys.ts";
import { command, query } from "@shivaedev/contract/operation.ts";
import { AuthUnavailable, Forbidden, NotFound } from "@shivaedev/errors/taxonomy.ts";
import { adminPage } from "#page.ts";
import { ChangeRoleInput, LastOwner, UserList, UserListInput } from "#users/roles.ts";

const users = collection("admin.users", Schema.String);

export const UsersList = Schema.Struct({ ...UserList.fields, canChangeRoles: Schema.Boolean });
export const UsersPage = adminPage({
	contract: contract("admin.users", {
		commands: [
			command("changeRole", {
				invalidates: () => [users.list],
				payload: ChangeRoleInput.fields,
				rejections: { AuthUnavailable, Forbidden, LastOwner, NotFound },
			}),
		],
		queries: [
			query("list", {
				payload: UserListInput.fields,
				reads: () => [users.list],
				rejections: { AuthUnavailable },
				success: UsersList,
			}),
		],
	}),
	id: "users",
	route: { path: "/admin/users", title: "Users" },
});
