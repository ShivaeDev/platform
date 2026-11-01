import { Duration, Effect, Exit, Schema } from "effect";
import { SessionUserSchema, type SessionUserWithProviderAccountsValue } from "#identity.ts";

const AccountUser = Schema.Struct({
	...SessionUserSchema.fields,
	providerAccounts: Schema.declare((value): value is SessionUserWithProviderAccountsValue["providerAccounts"] => Effect.isEffect(value)),
});

export const providerAccountsUser = Effect.fnUntraced(function* (value: unknown) {
	const { providerAccounts, ...user } = Schema.decodeUnknownSync(AccountUser)(value);
	const accounts = yield* Effect.cachedWithTTL(
		Effect.map(providerAccounts, (values) => values.map(({ accountId, providerId }) => ({ accountId, providerId }))),
		(exit) => (Exit.isSuccess(exit) ? Duration.infinity : Duration.zero),
	);
	return { ...user, providerAccounts: accounts };
});
