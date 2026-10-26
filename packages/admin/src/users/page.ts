import { Schema } from "effect";
import { contract } from "@shivaedev/contract/contract.ts";
import { AuthUnavailable, Forbidden, NotFound } from "@shivaedev/contract/errors/taxonomy.ts";
import { collection } from "@shivaedev/contract/keys.ts";
import { command, query } from "@shivaedev/contract/operation.ts";
import { ChangeRoleInput, LastOwner, UserList, UserListInput } from "@shivaedev/platform/rpc/userRoles.ts";
import { adminPage } from "#page.ts";

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
