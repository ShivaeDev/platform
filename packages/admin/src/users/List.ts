import type { UserList } from "@shivaedev/identity/users.ts";

export type UsersList = typeof UserList.Type & { readonly canChangeRoles: boolean };
