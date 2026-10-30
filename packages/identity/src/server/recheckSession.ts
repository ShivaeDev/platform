import { Effect, Option } from "effect";
import type { Headers } from "effect/http";
import { sessionAccess, sessionRequest } from "./lookupSession.ts";
import type { SessionPolicy, SessionShape } from "./session.ts";
import { SocketSession } from "./socketSession.ts";

export const recheckSession = Effect.fnUntraced(function* (policy: SessionPolicy<SessionShape>, headers: Headers.Headers, rpc: string) {
	const request = yield* sessionRequest(policy, headers, rpc);
	const socket = yield* Effect.serviceOption(SocketSession);
	const lookup = Effect.suspend(() => policy.provider.get(request.headers));
	const session = yield* Option.match(socket, { onNone: () => lookup, onSome: (shared) => shared.lookup(policy.provider, lookup) });
	return yield* sessionAccess(policy, session);
});
