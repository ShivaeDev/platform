import type { AuthContext, BetterAuthOptions } from "better-auth";
import { testUtils } from "better-auth/plugins";
import { Clock, Effect } from "effect";
import type { AuthDeclaration } from "@shivaedev/identity/server/better-auth/define.ts";
import { betterAuthMount } from "@shivaedev/identity/server/better-auth/mount.ts";
import { memoryStore } from "@shivaedev/rate-limit/memoryStore.ts";
import { signedSessionToken, testUserEmail } from "#identity/adapters/testingCredentials.ts";

type TestContext = ReturnType<ReturnType<typeof testUtils>["init"]>["context"];
type UserFields = NonNullable<Parameters<TestContext["test"]["createUser"]>[0]>;
type Login = Awaited<ReturnType<TestContext["test"]["login"]>>;
type AccountContext = Pick<AuthContext, "internalAdapter">;
type SessionContext = AccountContext & Pick<AuthContext, "sessionConfig" | "secret" | "authCookies" | "baseURL">;

function saveUser(context: AccountContext, fields: UserFields) {
	return Effect.flatMap(testUserEmail, (email) =>
		Effect.promise(() =>
			context.internalAdapter.createUser({ email, emailVerified: true, image: null, name: "Test User", ...fields }, { method: "test" }),
		),
	);
}

function cookieSameSite(value: string | undefined) {
	switch (value?.toLowerCase()) {
		case "strict":
			return "Strict";
		case "none":
			return "None";
		default:
			return "Lax";
	}
}

export const signedInUser = Effect.fnUntraced(function* (
	auth: { readonly $context: Promise<SessionContext> },
	{
		providerAccounts = [],
		...fields
	}: UserFields & {
		readonly providerAccounts?: readonly { readonly providerId: string; readonly accountId: string }[];
	},
): Effect.fn.Return<Login> {
	const context = yield* Effect.promise(() => auth.$context);
	const user = yield* saveUser(context, fields);
	for (const { providerId, accountId } of providerAccounts) {
		yield* Effect.promise(() => context.internalAdapter.createAccount({ accountId, providerId, userId: user.id }));
	}
	return yield* signInAgain(auth, user.id);
});

export const signInAgain = Effect.fnUntraced(function* (
	auth: { readonly $context: Promise<SessionContext> },
	userId: string,
): Effect.fn.Return<Login> {
	const { internalAdapter, sessionConfig, authCookies, secret, baseURL } = yield* Effect.promise(() => auth.$context);
	const now = yield* Clock.currentTimeMillis;
	const session = yield* Effect.promise(() => internalAdapter.createSession(userId, false, {}, true));
	const expiresAt = new Date(now + sessionConfig.expiresIn * 1000);
	yield* Effect.promise(() => internalAdapter.updateSession(session.token, { expiresAt }));
	const user = yield* Effect.promise(() => internalAdapter.findUserById(userId));
	if (user === null) {
		return yield* Effect.die(`User not found: ${userId}`);
	}
	const value = yield* signedSessionToken(session.token, secret);
	const { name, attributes } = authCookies.sessionToken;
	const cookies: Login["cookies"] = [
		{
			domain: URL.canParse(baseURL) ? new URL(baseURL).hostname : "localhost",
			httpOnly: attributes.httpOnly ?? true,
			name,
			path: attributes.path || "/",
			sameSite: cookieSameSite(attributes.sameSite),
			secure: attributes.secure ?? false,
			value,
			...(attributes.maxAge ? { expires: Math.floor(now / 1000) + attributes.maxAge } : {}),
		},
	];
	return { cookies, headers: new Headers({ cookie: `${name}=${value}` }), session: { ...session, expiresAt }, token: session.token, user };
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
	auth: { readonly $context: Promise<AccountContext & { readonly password: Pick<AuthContext["password"], "hash"> }> },
	{
		password,
		passwordHash,
		...fields
	}: UserFields & { readonly email: string } & (
			| { readonly password: string; readonly passwordHash?: never }
			| { readonly passwordHash: string; readonly password?: never }
		),
) {
	const context = yield* Effect.promise(() => auth.$context);
	const user = yield* saveUser(context, fields);
	const hash = passwordHash ?? (yield* Effect.promise(() => context.password.hash(password)));
	yield* Effect.promise(() =>
		context.internalAdapter.createAccount({ accountId: user.id, password: hash, providerId: "credential", userId: user.id }),
	);
	return user;
});

export const AUTH_TEST_SECRET = "story-auth-secret-with-at-least-32-characters";

export interface StoryAuthHost {
	readonly origin: string;
	readonly secureCookies?: boolean | undefined;
}

type DeclaredRole<TAuth> = TAuth extends { readonly defaultRole: infer TRole extends string } ? TRole : never;

export const storyAuth = Effect.fnUntraced(function* <const TOptions extends BetterAuthOptions>(
	declaration: AuthDeclaration<TOptions>,
	host: StoryAuthHost,
) {
	const { options } = declaration;
	const { auth } = yield* betterAuthMount({
		...declaration,
		options: {
			...options,
			advanced: { ...options.advanced, useSecureCookies: host.secureCookies ?? host.origin.startsWith("https:") },
			"baseURL": host.origin,
			plugins: [...(options.plugins ?? []), testUtils()],
			secret: options.secret ?? AUTH_TEST_SECRET,
		},
	}).pipe(Effect.provide(memoryStore));
	return auth;
});

export const mintUser = Effect.fnUntraced(function* <TAuth extends AuthDeclaration>(
	declaration: TAuth,
	host: StoryAuthHost,
	name: string,
	{ role }: { readonly role?: DeclaredRole<TAuth> | undefined } = {},
) {
	const auth = yield* storyAuth(declaration, host);
	return yield* signedInUser(auth, { email: `${name}@app.test`, name, ...(role === undefined ? {} : { role }) });
});
