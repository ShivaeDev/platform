import { Effect, Option } from "effect";
import type { Headers } from "effect/http";
import { sessionAccess, sessionRequest } from "./lookupSession.ts";
import { SessionPolicy } from "./SessionPolicy.ts";
import { SocketSession } from "./socketSession.ts";

export const recheckSession = Effect.fnUntraced(function* (headers: Headers.Headers, rpc: string) {
	const policy = yield* SessionPolicy;
	const request = yield* sessionRequest(headers, rpc);
	const socket = yield* Effect.serviceOption(SocketSession);
	const lookup = Effect.suspend(() => policy.provider.get(request.headers));
	const session = yield* Option.match(socket, { onNone: () => lookup, onSome: (shared) => shared.lookup(policy.provider, lookup) });
	return yield* sessionAccess(session);
});
