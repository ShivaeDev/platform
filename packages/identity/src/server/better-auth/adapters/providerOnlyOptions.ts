import type { BetterAuthOptions, GenericEndpointContext } from "better-auth";

const closedPaths = [
	"/sign-in/email",
	"/sign-up/email",
	"/request-password-reset",
	"/reset-password",
	"/change-password",
	"/verify-password",
	"/change-email",
	"/send-verification-email",
	"/verify-email",
	"/sign-in/magic-link",
	"/magic-link/verify",
	"/admin/set-role",
	"/admin/get-user",
	"/admin/create-user",
	"/admin/update-user",
	"/admin/list-users",
	"/admin/list-user-sessions",
	"/admin/unban-user",
	"/admin/ban-user",
	"/admin/impersonate-user",
	"/admin/stop-impersonating",
	"/admin/revoke-user-session",
	"/admin/revoke-user-sessions",
	"/admin/remove-user",
	"/admin/set-user-password",
	"/admin/has-permission",
];

type AccountHooks = NonNullable<NonNullable<BetterAuthOptions["databaseHooks"]>["account"]>;
type AccountBefore = NonNullable<NonNullable<AccountHooks["create"]>["before"]>;
type Before<T> = (data: T, context: GenericEndpointContext | null) => ReturnType<AccountBefore>;

function withoutTokens<T extends object>(before?: Before<T>) {
	return async (data: T, context: GenericEndpointContext | null) => {
		const result = await before?.(data, context);
		if (result === false) {
			return false;
		}
		return { data: { ...data, ...(typeof result === "object" ? result.data : {}), accessToken: null, idToken: null, refreshToken: null } };
	};
}

export function providerOnlyOptions<TOptions extends BetterAuthOptions>(options: TOptions, enabledPaths: readonly string[] = []): TOptions {
	const account = options.databaseHooks?.account;
	return {
		...options,
		account: { ...options.account, storeAccountCookie: false },
		databaseHooks: {
			...options.databaseHooks,
			account: {
				...account,
				create: { ...account?.create, before: withoutTokens(account?.create?.before) },
				update: { ...account?.update, before: withoutTokens(account?.update?.before) },
			},
		},
		disabledPaths: [...(options.disabledPaths ?? []), ...closedPaths.filter((path) => !enabledPaths.includes(path))],
		emailAndPassword: { ...options.emailAndPassword, enabled: false },
		session: { ...options.session, cookieCache: { ...options.session?.cookieCache, enabled: false } },
	};
}
