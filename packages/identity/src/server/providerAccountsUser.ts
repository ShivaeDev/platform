import { Duration, Effect, Exit } from "effect";
import { decodeProviderAccountsUser } from "#server/decodeSessionUser.ts";

export const providerAccountsUser = Effect.fnUntraced(function* (value: unknown) {
	const { providerAccounts, ...user } = yield* decodeProviderAccountsUser(value);
	const accounts = yield* Effect.cachedWithTTL(
		Effect.map(providerAccounts, (values) => values.map(({ accountId, providerId }) => ({ accountId, providerId }))),
		(exit) => (Exit.isSuccess(exit) ? Duration.infinity : Duration.zero),
	);
	return { ...user, providerAccounts: accounts };
});
