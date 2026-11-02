import { Context, Effect, Option, Schema } from "effect";
import { type AuthUnavailable, type Forbidden, Unauthorized } from "@shivaedev/errors/taxonomy.ts";
import { SessionUser, SessionUserSchema, SessionUserWithProviderAccounts } from "#identity.ts";
import { providerAccountsUser } from "./providerAccountsUser.ts";
import type { SessionShape } from "./session.ts";

export const currentSessionContext = Effect.fnUntraced(function* <TSession extends SessionShape, R>(
	id: string,
	lookup: Effect.Effect<Option.Option<TSession>, AuthUnavailable | Forbidden, R>,
) {
	const session = yield* lookup;
	if (Option.isNone(session) || session.value.user.id !== id) {
		return yield* new Unauthorized({ message: "Authentication required" });
	}
	let context = yield* Effect.context<never>();
	if (Option.isSome(Context.getOption(context, SessionUser))) {
		context = Context.add(context, SessionUser, Schema.decodeUnknownSync(SessionUserSchema)(session.value.user));
	}
	if (Option.isSome(Context.getOption(context, SessionUserWithProviderAccounts))) {
		context = Context.add(context, SessionUserWithProviderAccounts, yield* providerAccountsUser(session.value.user));
	}
	return context;
});
