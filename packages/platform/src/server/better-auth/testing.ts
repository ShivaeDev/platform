import type { AuthContext } from "better-auth";
import { testUtils } from "better-auth/plugins";

export function authTestUtils(options?: Parameters<typeof testUtils>[0]) {
	const plugin = testUtils(options);
	return {
		...plugin,
		init(context: Parameters<typeof plugin.init>[0]) {
			const result = plugin.init(context);
			// Remove this wrapper once Better Auth's testUtils omits undefined options.
			return result.options === undefined ? { context: result.context } : { context: result.context, options: result.options };
		},
	};
}

type TestContext = ReturnType<ReturnType<typeof authTestUtils>["init"]>["context"];
type AccountContext = Pick<AuthContext, "internalAdapter">;

export async function signedInUser(
	auth: { readonly $context: Promise<TestContext & AccountContext> },
	{
		providerAccounts = [],
		...fields
	}: Parameters<TestContext["test"]["createUser"]>[0] & {
		readonly providerAccounts?: readonly { readonly providerId: string; readonly accountId: string }[];
	},
) {
	const { test, internalAdapter } = await auth.$context;
	const user = await test.saveUser(test.createUser(fields));
	for (const { providerId, accountId } of providerAccounts) {
		await internalAdapter.createAccount({ accountId, providerId, userId: user.id });
	}
	return test.login({ userId: user.id });
}

export async function storedProviderAccounts(auth: { readonly $context: Promise<AccountContext> }, userId: string) {
	const { internalAdapter } = await auth.$context;
	const accounts = await internalAdapter.findAccounts(userId);
	return accounts.map(({ providerId, accountId, accessToken, refreshToken, idToken, password }) => ({
		accountId,
		hasAccessToken: Boolean(accessToken),
		hasIdToken: Boolean(idToken),
		hasPassword: Boolean(password),
		hasRefreshToken: Boolean(refreshToken),
		providerId,
	}));
}
