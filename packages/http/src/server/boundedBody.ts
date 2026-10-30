import { Effect, Schema } from "effect";
import { HttpIncomingMessage, type HttpServerRequest, HttpServerRespondable, HttpServerResponse } from "effect/http";
import * as HttpStatus from "effect/http/HttpStatus";

export class RequestBodyTooLarge
	extends Schema.TaggedError<RequestBodyTooLarge>()("RequestBodyTooLarge", { limit: Schema.Number })
	implements HttpServerRespondable.Respondable
{
	[HttpServerRespondable.symbol]() {
		return Effect.succeed(HttpServerResponse.empty({ status: HttpStatus.fromLiteral("PayloadTooLarge") }));
	}
}

export const readBoundedBody = Effect.fnUntraced(function* (request: HttpServerRequest.HttpServerRequest) {
	const maxBodySize = yield* HttpIncomingMessage.MaxBodySize;
	if (maxBodySize === undefined) {
		return yield* new RequestBodyTooLarge({ limit: 0 });
	}
	const limit = Number(maxBodySize);
	const length = request.headers["content-length"];
	if (length !== undefined && BigInt(length) > maxBodySize) {
		return yield* new RequestBodyTooLarge({ limit });
	}
	return yield* request.arrayBuffer.pipe(
		Effect.catchIf(
			(error) => error.reason._tag === "RequestParseError" && error.reason.reason === "BodyTooLarge",
			() => new RequestBodyTooLarge({ limit }),
		),
	);
});
