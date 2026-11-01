import { ByteSize, Cause, Effect, ErrorReporter, Layer, Option, Schema } from "effect";
import { HttpIncomingMessage, HttpRouter, HttpServerRequest, HttpServerResponse } from "effect/http";
import * as HttpStatus from "effect/http/HttpStatus";
import { RateLimiter } from "effect/persistence";
import { localTransport, trustedProxyPeer } from "@shivaedev/identity/server/local.ts";

const BrowserErrorReport = Schema.Struct({
	kind: Schema.Literals(["error", "unhandledrejection"]),
	message: Schema.String,
	stack: Schema.optional(Schema.String),
	url: Schema.String,
});

const receiveReport = Effect.gen(function* () {
	const parsed = yield* HttpServerRequest.schemaBodyJson(BrowserErrorReport).pipe(
		Effect.provideService(HttpIncomingMessage.MaxBodySize, ByteSize.kibibytes(16)),
		Effect.option,
	);
	if (Option.isNone(parsed)) {
		return HttpServerResponse.empty({ status: HttpStatus.fromLiteral("BadRequest") });
	}
	const error = new Error(parsed.value.message);
	error.name = "BrowserError";
	if (parsed.value.stack !== undefined) {
		error.stack = parsed.value.stack;
	}
	yield* ErrorReporter.report(Cause.die(error)).pipe(Effect.annotateLogs({ "browser.kind": parsed.value.kind, "url.full": parsed.value.url }));
	return HttpServerResponse.empty({ status: HttpStatus.fromLiteral("Accepted") });
});

export function browserErrorRoute(trustedProxy?: string) {
	return HttpRouter.use((router) =>
		Effect.gen(function* () {
			const limiter = yield* RateLimiter.RateLimiter;
			const allowed = localTransport(trustedProxy);
			const trusted = trustedProxyPeer(trustedProxy);
			yield* router.add(
				"POST",
				"/_platform/errors",
				Effect.gen(function* () {
					const request = yield* HttpServerRequest.HttpServerRequest;
					if (!allowed(request)) {
						return HttpServerResponse.empty({ status: HttpStatus.fromLiteral("Forbidden") });
					}
					const peer = Option.getOrElse(request.remoteAddress, () => "unknown");
					const client = trusted(peer) ? (request.headers["x-real-ip"] ?? peer) : peer;
					const accepted = yield* limiter.consume({ key: client, limit: 20, window: "1 minute" }).pipe(Effect.isSuccess);
					if (!accepted) {
						return HttpServerResponse.empty({ status: HttpStatus.fromLiteral("TooManyRequests") });
					}
					return yield* receiveReport;
				}),
			);
		}),
	).pipe(Layer.provide(RateLimiter.layer.pipe(Layer.provide(RateLimiter.layerStoreMemory))));
}
