import { Data, Effect } from "effect";
import { HttpIncomingMessage, type HttpServerRequest, HttpServerRespondable, HttpServerResponse } from "effect/http";
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
	const limit = yield* HttpIncomingMessage.MaxBodySize;
	if (limit === undefined) {
		return yield* request.arrayBuffer;
	}
	const length = request.headers["content-length"];
	if (length !== undefined && BigInt(length) > limit) {
		return yield* new RequestBodyTooLarge({ limit, request });
	}
	return yield* request.arrayBuffer.pipe(
		Effect.catchIf(
			(error) => error.reason._tag === "RequestParseError" && error.reason.reason === "BodyTooLarge",
			() => new RequestBodyTooLarge({ limit, request }),
		),
	);
});
