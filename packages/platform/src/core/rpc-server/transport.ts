import { Effect, Option } from "effect";
import { type Headers, HttpServerRequest } from "effect/unstable/http";

export const transportHeaders = (rpcHeaders: Headers.Headers): Effect.Effect<Headers.Headers> =>
	Effect.map(
		Effect.serviceOption(HttpServerRequest.HttpServerRequest),
		Option.match({ onNone: () => rpcHeaders, onSome: (request) => request.headers }),
	);
