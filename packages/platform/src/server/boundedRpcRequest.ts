import { NodeHttpServerRequest, NodeStream } from "@effect/platform-node";
import { Effect, Stream } from "effect";
import { HttpIncomingMessage, HttpServerError, type HttpServerRequest } from "effect/unstable/http";

export function boundedRpcRequest(request: HttpServerRequest.HttpServerRequest): HttpServerRequest.HttpServerRequest {
	const incoming = NodeHttpServerRequest.toIncomingMessage(request);
	function error(cause: unknown) {
		return new HttpServerError.HttpServerError({ reason: new HttpServerError.RequestParseError({ cause, request }) });
	}
	const text = Effect.gen(function* () {
		const limit = yield* HttpIncomingMessage.MaxBodySize;
		const chunks: Uint8Array[] = [];
		let size = 0n;
		yield* NodeStream.fromReadable<Uint8Array, HttpServerError.HttpServerError>({
			closeOnDone: false,
			evaluate: () => incoming,
			onError: error,
		}).pipe(
			Stream.runForEach((chunk) => {
				size += BigInt(chunk.byteLength);
				if (limit !== undefined && size > limit) {
					return Effect.fail(error(new Error("RPC body exceeds MAX_BODY_SIZE")));
				}
				chunks.push(chunk);
				return Effect.void;
			}),
		);
		return Buffer.concat(chunks).toString("utf8");
	}).pipe(
		Effect.onError(() => Effect.sync(() => incoming.resume())),
		Effect.cached,
		Effect.runSync,
	);
	const arrayBuffer = Effect.map(text, (body) => new TextEncoder().encode(body).buffer);
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
