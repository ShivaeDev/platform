import { Effect, Option } from "effect";
import type { Headers } from "effect/unstable/http";
import { AuthUnavailable } from "../../errors/taxonomy.ts";
import { redact } from "../redact.ts";
import type { SessionProvider, SessionShape } from "../session.ts";

export type GetSession<Session extends SessionShape> = (headers: globalThis.Headers) => Promise<Session | null>;

const unavailable = (cause: unknown) =>
	Effect.andThen(
		Effect.logError("Authentication provider failed", redact(cause)),
		Effect.fail(new AuthUnavailable({ message: "Authentication is temporarily unavailable" })),
	);

export const betterAuthSessions = <Session extends SessionShape>(getSession: GetSession<Session>): SessionProvider<Session> => ({
	get: Effect.fn("PlatformRpc.betterAuthSession")(function* (headers: Headers.Headers) {
		const session = yield* Effect.tryPromise(() => getSession(new globalThis.Headers(headers))).pipe(
			Effect.catch((error) => unavailable(error.cause)),
		);
		return Option.fromNullishOr(session);
	}),
});
