import * as NodeHttpServerRequest from "@effect/platform-node/NodeHttpServerRequest";
import * as NodeStream from "@effect/platform-node/NodeStream";
import { Data, Effect, Stream } from "effect";
import { HttpIncomingMessage, HttpServerError, type HttpServerRequest, HttpServerRespondable, HttpServerResponse } from "effect/http";
import * as HttpStatus from "effect/http/HttpStatus";

export class RequestBodyTooLarge
	extends Data.TaggedError("RequestBodyTooLarge")<{
		readonly request: HttpServerRequest.HttpServerRequest;
		readonly limit: bigint;
	}>
	implements HttpServerRespondable.Respondable
{
	[HttpServerRespondable.symbol]() {
		return Effect.succeed(HttpServerResponse.empty({ status: HttpStatus.fromLiteral("PayloadTooLarge") }));
	}
}

export const readBoundedBody = Effect.fnUntraced(function* (request: HttpServerRequest.HttpServerRequest) {
	const incoming = NodeHttpServerRequest.toIncomingMessage(request);
	const limit = yield* HttpIncomingMessage.MaxBodySize;
	const read = Effect.gen(function* () {
		const length = request.headers["content-length"];
		if (limit !== undefined && length !== undefined && BigInt(length) > limit) {
			return yield* new RequestBodyTooLarge({ limit, request });
		}
		const chunks: Uint8Array[] = [];
		let size = 0n;
		yield* NodeStream.fromReadable<Uint8Array, HttpServerError.HttpServerError>({
			closeOnDone: false,
			evaluate: () => incoming,
			onError: (cause) => new HttpServerError.HttpServerError({ reason: new HttpServerError.RequestParseError({ cause, request }) }),
		}).pipe(
			Stream.runForEach((chunk) => {
				size += BigInt(chunk.byteLength);
				if (limit !== undefined && size > limit) {
					return Effect.fail(new RequestBodyTooLarge({ limit, request }));
				}
				chunks.push(chunk);
				return Effect.void;
			}),
		);
		return Uint8Array.from(Buffer.concat(chunks)).buffer;
	});
	// Drain unread bytes without destroying the socket so the server can send a response.
	return yield* read.pipe(Effect.onError(() => Effect.sync(() => incoming.resume())));
});
