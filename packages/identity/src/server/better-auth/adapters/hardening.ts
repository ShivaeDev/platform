import type { BetterAuthOptions, BetterAuthPlugin } from "better-auth";
import { APIError, createAuthMiddleware, dispatchAuthEndpoint, verifyPassword } from "better-auth/api";

export interface BetterAuthHardeningOptions {
	readonly requirePasswordForEmailChange?: boolean;
}

const emailChangePassword = {
	hooks: {
		before: [
			{
				handler: createAuthMiddleware(async (ctx) => {
					const password: unknown = ctx.body?.password;
					if (typeof password !== "string" || password.length === 0 || password.length > ctx.context.password.config.maxPasswordLength) {
						throw new APIError("BAD_REQUEST", { code: "INVALID_PASSWORD", message: "Current password is required" });
					}
					// Bearer conversion finishes after before hooks, so verification needs its own dispatch.
					await dispatchAuthEndpoint(verifyPassword, { asResponse: false, body: { password }, context: ctx.context, headers: ctx.headers });
				}),
				matcher: (ctx) => ctx.path === "/change-email",
			},
		],
	},
	id: "identity-email-change-password",
} satisfies BetterAuthPlugin;

export function withHardening<TOptions extends BetterAuthOptions>(options: TOptions, hardening: BetterAuthHardeningOptions = {}): TOptions {
	return {
		...options,
		emailAndPassword: options.emailAndPassword && {
			...options.emailAndPassword,
			revokeSessionsOnPasswordReset: options.emailAndPassword.revokeSessionsOnPasswordReset ?? true,
		},
		plugins: [...(options.plugins ?? []), ...(hardening.requirePasswordForEmailChange === false ? [] : [emailChangePassword])],
	};
}
