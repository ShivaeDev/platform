import { Effect, Option } from "effect";
import { type Headers, HttpServerRequest } from "effect/http";
export function transportHeaders(rpcHeaders: Headers.Headers): Effect.Effect<Headers.Headers> {
	return Effect.map(
		Effect.serviceOption(HttpServerRequest.HttpServerRequest),
		Option.match({ onNone: () => rpcHeaders, onSome: (request) => request.headers }),
	);
}
