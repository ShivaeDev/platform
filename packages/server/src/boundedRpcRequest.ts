import { Effect } from "effect";
import { HttpServerError, HttpServerRequest } from "effect/http";
import { readBoundedBody } from "@shivaedev/http/server/boundedBody.ts";

export const boundedRpcRequest = Effect.fnUntraced(function* () {
	const request = yield* HttpServerRequest.HttpServerRequest;
	const arrayBuffer = yield* readBoundedBody().pipe(
		Effect.provideService(HttpServerRequest.HttpServerRequest, request),
		Effect.mapError((cause) =>
			cause._tag === "RequestBodyTooLarge"
				? new HttpServerError.HttpServerError({ reason: new HttpServerError.RequestParseError({ cause, request }) })
				: cause,
		),
		Effect.cached,
	);
	const text = Effect.map(arrayBuffer, (body) => new TextDecoder().decode(body));
	// The native text reader destroys the HTTP socket on overflow, preventing a 4xx response.
	return new Proxy(request, {
		get: (target, key, receiver) => {
			if (key === "text") {
				return text;
			}
			if (key === "arrayBuffer") {
				return arrayBuffer;
			}
			return Reflect.get(target, key, receiver);
		},
	});
});
