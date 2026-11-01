import type { BetterAuthOptions } from "better-auth";
import type { Effect } from "effect";
import type { BetterAuthPasswordReset } from "#server/better-auth/PasswordReset.ts";
import type { hookRuntime } from "./hookRuntime.ts";

export function passwordResetOptions<TOptions extends BetterAuthOptions, R>(
	options: TOptions,
	hook: BetterAuthPasswordReset<R> | undefined,
	runtime: Effect.Success<ReturnType<typeof hookRuntime<R>>>,
): TOptions {
	if (hook === undefined) {
		return options;
	}
	return {
		...options,
		emailAndPassword: {
			...options.emailAndPassword,
			enabled: options.emailAndPassword?.enabled ?? false,
			onPasswordReset: async (data, request) => {
				await options.emailAndPassword?.onPasswordReset?.(data, request);
				await runtime.runHook(() => hook(data), request?.signal);
			},
		},
	};
}
