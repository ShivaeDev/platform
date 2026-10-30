import type { BetterAuthOptions } from "better-auth";
import { admin } from "better-auth/plugins/admin";

export function closeRoleEndpoints<TOptions extends BetterAuthOptions>(options: TOptions): TOptions {
	return {
		...options,
		disabledPaths: [...(options.disabledPaths ?? []), "/admin/set-role", "/admin/update-user", "/admin/create-user"],
		plugins: options.plugins?.map((plugin) => (plugin.id === "admin" ? admin({ ...plugin.options, adminRoles: [] }) : plugin)),
	};
}
