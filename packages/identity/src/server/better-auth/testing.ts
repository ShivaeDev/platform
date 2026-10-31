import type { AuthContext } from "better-auth";
import type { testUtils } from "better-auth/plugins";
import { Clock, Effect } from "effect";

type TestContext = ReturnType<ReturnType<typeof testUtils>["init"]>["context"];
type AccountContext = Pick<AuthContext, "internalAdapter">;

export const signedInUser = Effect.fnUntraced(function* (
	auth: { readonly $context: Promise<TestContext & AccountContext & Pick<AuthContext, "sessionConfig">> },
	{
		providerAccounts = [],
		...fields
	}: Parameters<TestContext["test"]["createUser"]>[0] & {
		readonly providerAccounts?: readonly { readonly providerId: string; readonly accountId: string }[];
	},
) {
	const { test, internalAdapter } = yield* Effect.promise(() => auth.$context);
	const user = yield* Effect.promise(() => test.saveUser(test.createUser(fields)));
	for (const { providerId, accountId } of providerAccounts) {
		yield* Effect.promise(() => internalAdapter.createAccount({ accountId, providerId, userId: user.id }));
	}
	return yield* signInAgain(auth, user.id);
});

export const signInAgain = Effect.fnUntraced(function* (
	auth: { readonly $context: Promise<TestContext & AccountContext & Pick<AuthContext, "sessionConfig">> },
	userId: string,
) {
	const { test, internalAdapter, sessionConfig } = yield* Effect.promise(() => auth.$context);
	const now = yield* Clock.currentTimeMillis;
	const login = yield* Effect.promise(() => test.login({ userId }));
	const expiresAt = new Date(now + sessionConfig.expiresIn * 1000);
	yield* Effect.promise(() => internalAdapter.updateSession(login.token, { expiresAt }));
	return { ...login, session: { ...login.session, expiresAt } };
});

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

export const passwordUser = Effect.fnUntraced(function* (
	auth: { readonly $context: Promise<TestContext & AccountContext & { readonly password: Pick<AuthContext["password"], "hash"> }> },
	{ password, ...fields }: Parameters<TestContext["test"]["createUser"]>[0] & { readonly email: string; readonly password: string },
) {
	const { test, internalAdapter, password: credential } = yield* Effect.promise(() => auth.$context);
	const user = yield* Effect.promise(() => test.saveUser(test.createUser(fields)));
	const hash = yield* Effect.promise(() => credential.hash(password));
	yield* Effect.promise(() => internalAdapter.createAccount({ accountId: user.id, password: hash, providerId: "credential", userId: user.id }));
	return user;
});
