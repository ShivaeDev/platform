import { Effect, Option } from "effect";
import type { Headers } from "effect/http";
import { AuthUnavailable } from "#errors/taxonomy.ts";
import { redact } from "#rpc-server/redact.ts";
import type { SessionProvider, SessionShape } from "#rpc-server/session.ts";
export type GetSession<TSession extends SessionShape> = (headers: globalThis.Headers) => Promise<TSession | null>;
function unavailable(cause: unknown) {
	return Effect.andThen(
		Effect.logError("Authentication provider failed", redact(cause)),
		Effect.fail(new AuthUnavailable({ message: "Authentication is temporarily unavailable" })),
	);
}
export function betterAuthSessions<TSession extends SessionShape>(getSession: GetSession<TSession>): SessionProvider<TSession> {
	const betterAuthSession = Effect.fn("PlatformRpc.betterAuthSession")(function* (headers: Headers.Headers) {
		const session = yield* Effect.tryPromise(() => getSession(new globalThis.Headers(headers))).pipe(
			Effect.catch((error) => unavailable(error.cause)),
		);
		return Option.fromNullishOr(session);
	});
	return { get: betterAuthSession };
}
