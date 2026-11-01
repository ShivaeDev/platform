import { ByteSize, Cause, Effect, ErrorReporter, Layer, Option, Schema } from "effect";
import { HttpIncomingMessage, HttpRouter, HttpServerRequest, HttpServerResponse } from "effect/http";
import * as HttpStatus from "effect/http/HttpStatus";
import { RateLimiter } from "effect/persistence";
import { redactBrowserText } from "@shivaedev/errors/redactBrowserText.ts";
import { isAuthUnavailable, isForbidden } from "@shivaedev/errors/taxonomy.ts";
import { localTransport, trustedProxyPeer } from "@shivaedev/identity/server/local.ts";
import { SessionPolicy } from "@shivaedev/identity/server/SessionPolicy.ts";
import { resolveSession } from "@shivaedev/identity/server/session.ts";

const BrowserErrorReport = Schema.Struct({
	kind: Schema.Literals(["error", "unhandledrejection"]),
	message: Schema.String,
	stack: Schema.optional(Schema.String),
	url: Schema.String,
});

export interface BrowserErrorOptions {
	readonly includeUserId?: boolean;
	readonly log?: boolean;
	readonly requireSession?: boolean;
}

class BrowserError extends Error {
	override readonly name = "BrowserError";
	override readonly [ErrorReporter.severity] = "Error";
}

const receiveReport = Effect.fnUntraced(function* (options: BrowserErrorOptions, userId?: string) {
	const parsed = yield* HttpServerRequest.schemaBodyJson(BrowserErrorReport).pipe(
		Effect.provideService(HttpIncomingMessage.MaxBodySize, ByteSize.kibibytes(16)),
		Effect.option,
	);
	if (Option.isNone(parsed)) {
		return HttpServerResponse.empty({ status: HttpStatus.fromLiteral("BadRequest") });
	}
	const error = new BrowserError(redactBrowserText(parsed.value.message));
	if (parsed.value.stack !== undefined) {
		error.stack = redactBrowserText(parsed.value.stack);
	}
	const cause = Cause.die(error);
	if (userId !== undefined) {
		yield* Effect.annotateCurrentSpan("user.id", userId);
	}
	yield* Effect.gen(function* () {
		yield* ErrorReporter.report(cause);
		if (options.log) {
			yield* Effect.logError("Browser error", cause);
		}
	}).pipe(
		Effect.annotateLogs({ "browser.kind": parsed.value.kind, "url.full": parsed.value.url, ...(userId === undefined ? {} : { "user.id": userId }) }),
	);
	return HttpServerResponse.empty({ status: HttpStatus.fromLiteral("Accepted") });
});

const receiveForSession = Effect.fnUntraced(function* (options: BrowserErrorOptions, policy: Option.Option<SessionPolicy["Service"]>) {
	if (!(options.requireSession || options.includeUserId)) {
		return yield* receiveReport(options);
	}
	const request = yield* HttpServerRequest.HttpServerRequest;
	const session = Option.isSome(policy)
		? yield* resolveSession(request.headers, "$browserError").pipe(Effect.provideService(SessionPolicy, policy.value))
		: Option.none();
	if (options.requireSession && Option.isNone(session)) {
		return HttpServerResponse.empty({ status: HttpStatus.fromLiteral("Unauthorized") });
	}
	return yield* receiveReport(options, options.includeUserId && Option.isSome(session) ? session.value.user.id : undefined);
});

export function browserErrorRoute(trustedProxy?: string, options: BrowserErrorOptions = {}) {
	return HttpRouter.use((router) =>
		Effect.gen(function* () {
			const limiter = yield* RateLimiter.RateLimiter;
			const policy = yield* Effect.serviceOption(SessionPolicy);
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
					return yield* receiveForSession(options, policy);
				}).pipe(
					Effect.catchIf(isAuthUnavailable, () => Effect.succeed(HttpServerResponse.empty({ status: HttpStatus.fromLiteral("ServiceUnavailable") }))),
					Effect.catchIf(isForbidden, () => Effect.succeed(HttpServerResponse.empty({ status: HttpStatus.fromLiteral("Forbidden") }))),
				),
			);
		}),
	).pipe(Layer.provide(RateLimiter.layer.pipe(Layer.provide(RateLimiter.layerStoreMemory))));
}
