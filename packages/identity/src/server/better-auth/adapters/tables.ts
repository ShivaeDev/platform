import type { BetterAuthOptions } from "better-auth";
import { type BetterAuthDBSchema, getAuthTables } from "better-auth/db";

export type AuthTableOptions = Pick<BetterAuthOptions, "user" | "account" | "plugins">;

function field(table: BetterAuthDBSchema[string] | undefined, name: string) {
	return table?.fields[name]?.fieldName ?? name;
}

export function tables(options: AuthTableOptions = {}) {
	const schema = getAuthTables(options);
	return {
		account: {
			accountId: field(schema.account, "accountId"),
			providerId: field(schema.account, "providerId"),
			table: schema.account?.modelName ?? "account",
			userId: field(schema.account, "userId"),
		},
		user: {
			createdAt: field(schema.user, "createdAt"),
			email: field(schema.user, "email"),
			name: field(schema.user, "name"),
			role: field(schema.user, "role"),
			table: schema.user?.modelName ?? "user",
			updatedAt: field(schema.user, "updatedAt"),
		},
	};
}
