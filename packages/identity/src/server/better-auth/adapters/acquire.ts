import { type BetterAuthOptions, betterAuth } from "better-auth";
import { Effect } from "effect";
import { profileStorage } from "#server/better-auth/adapters/profileStorage.ts";
import { providerFailure } from "#server/providerFailure.ts";

export const acquireAuth = Effect.fnUntraced(function* <TOptions extends BetterAuthOptions>(options: TOptions) {
	const auth = betterAuth({
		...options,
		advanced: { ...options.advanced, database: { joins: true, ...options.advanced?.database } },
	});
	const context = yield* Effect.tryPromise(async () => {
		const ready = await auth.$context;
		await ready.checkSchema?.();
		return ready;
	}).pipe(
		Effect.uninterruptible,
		Effect.catch((error) => providerFailure(error.cause)),
	);
	return { auth, profiles: profileStorage(context) };
});
