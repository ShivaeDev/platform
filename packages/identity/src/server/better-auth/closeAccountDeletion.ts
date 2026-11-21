import type { BetterAuthOptions } from "better-auth";

// Identity's account module is the one way to delete an account, because Better Auth's deletion runs outside any transaction.
export function closeAccountDeletion<TOptions extends BetterAuthOptions>(options: TOptions): TOptions {
	return { ...options, disabledPaths: [...(options.disabledPaths ?? []), "/delete-user", "/delete-user/callback"] };
}
