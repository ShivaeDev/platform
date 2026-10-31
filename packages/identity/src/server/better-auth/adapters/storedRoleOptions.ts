import type { BetterAuthOptions } from "better-auth";

export interface StoredRoleOptions {
	readonly defaultRole: string;
}

export function storedRoleOptions<TOptions extends BetterAuthOptions>(options: TOptions, role?: StoredRoleOptions): TOptions {
	if (role === undefined) {
		return options;
	}
	return {
		...options,
		user: {
			...options.user,
			additionalFields: {
				...options.user?.additionalFields,
				role: { defaultValue: role.defaultRole, input: false, required: true, type: "string" },
			},
		},
	};
}
