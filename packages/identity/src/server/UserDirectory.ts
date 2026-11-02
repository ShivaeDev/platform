import { Context, type Effect } from "effect";
import type { AuthUnavailable, NotFound } from "@shivaedev/errors/taxonomy.ts";
import type { LastRoleAssigner } from "#roles.ts";
import type { AccountName, UserList, UserListInput } from "#users.ts";

export class UserDirectory extends Context.Service<
	UserDirectory,
	{
		readonly list: (input: typeof UserListInput.Type) => Effect.Effect<typeof UserList.Type, AuthUnavailable>;
		readonly role: (userId: string) => Effect.Effect<string, AuthUnavailable | NotFound>;
		readonly assignRole: (userId: string, role: string) => Effect.Effect<boolean, AuthUnavailable | NotFound | LastRoleAssigner>;
		readonly names: (userIds: readonly string[]) => Effect.Effect<readonly (typeof AccountName.Type)[], AuthUnavailable>;
	}
>()("@shivaedev/identity/UserDirectory") {}
