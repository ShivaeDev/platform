import type { BetterAuthOptions, BetterAuthPlugin } from "better-auth";
import { createAuthMiddleware } from "better-auth/api";
import { Effect, Option, Schema } from "effect";
import { AccountPreferenceValues } from "#accountPreferenceValues.ts";
import { AccountPreferencesStore } from "#server/account-preferences/service.ts";

export const accountPreferenceOptions = Effect.fnUntraced(function* <TOptions extends BetterAuthOptions>(options: TOptions) {
	const store = yield* AccountPreferencesStore;
	const services = yield* Effect.context<never>();
	const capture = createAuthMiddleware(async (context) => {
		const session = context.context.newSession ?? context.context.session;
		const values = Schema.decodeUnknownOption(AccountPreferenceValues)({
			locale: context.headers?.get("x-platform-account-locale"),
			timezone: context.headers?.get("x-platform-account-timezone"),
			units: "metric",
		});
		if (session !== null && session !== undefined && Option.isSome(values)) {
			await Effect.runPromiseWith(services)(store.capture(session.user.id, values.value), { signal: context.request?.signal });
		}
	});
	const plugin = {
		hooks: {
			after: [
				{
					handler: capture,
					matcher: (context) => context.path === "/get-session" || (context.context.newSession !== null && context.context.newSession !== undefined),
				},
			],
		},
		id: "identity-account-preferences",
	} satisfies BetterAuthPlugin;
	return { ...options, plugins: [...(options.plugins ?? []), plugin] } satisfies BetterAuthOptions;
});
