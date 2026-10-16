import { Effect } from "effect";
import { HttpServerError, type HttpServerRequest } from "effect/http";
import { readBoundedBody } from "./boundedBody.ts";

export function boundedRpcRequest(request: HttpServerRequest.HttpServerRequest): HttpServerRequest.HttpServerRequest {
	const arrayBuffer = readBoundedBody(request).pipe(
		Effect.mapError((cause) =>
			cause._tag === "RequestBodyTooLarge"
				? new HttpServerError.HttpServerError({ reason: new HttpServerError.RequestParseError({ cause, request }) })
				: cause,
		),
		Effect.cached,
		Effect.runSync,
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
}
