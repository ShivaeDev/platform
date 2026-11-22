import { Context, Effect, Option } from "effect";
import { unauthorized } from "@shivaedev/access/refusal.ts";
import type { AuthUnavailable, Forbidden } from "@shivaedev/errors/taxonomy.ts";
import { SessionUser, SessionUserWithProviderAccounts } from "#identity.ts";
import { decodeSessionUser } from "#server/decodeSessionUser.ts";
import { providerAccountsUser } from "#server/providerAccountsUser.ts";
import type { SessionShape } from "#server/session.ts";

export const currentSessionContext = Effect.fnUntraced(function* <TSession extends SessionShape, R, E = AuthUnavailable | Forbidden>(
	id: string,
	lookup: Effect.Effect<Option.Option<TSession>, E, R>,
) {
	const session = yield* lookup;
	if (Option.isNone(session) || session.value.user.id !== id) {
		return yield* unauthorized();
	}
	let context = yield* Effect.context<never>();
	if (Option.isSome(Context.getOption(context, SessionUser))) {
		context = Context.add(context, SessionUser, yield* decodeSessionUser(session.value.user));
	}
	if (Option.isSome(Context.getOption(context, SessionUserWithProviderAccounts))) {
		context = Context.add(context, SessionUserWithProviderAccounts, yield* providerAccountsUser(session.value.user));
	}
	return context;
});
