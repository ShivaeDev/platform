import { Effect, type Scope } from "effect";
import { Headers, HttpServerRequest, HttpServerResponse } from "effect/http";
import * as HttpStatus from "effect/http/HttpStatus";
import { localTransport } from "@shivaedev/identity/server/local.ts";
import { resolveSession, type SessionShape } from "@shivaedev/identity/server/session.ts";
import { makeSocketSession, SocketSession } from "@shivaedev/identity/server/socketSession.ts";
import type { HostPolicy } from "#hostOptions.ts";

export function socketRpc<TSession extends SessionShape>(
	handler: Effect.Effect<HttpServerResponse.HttpServerResponse, never, HttpServerRequest.HttpServerRequest | Scope.Scope>,
	policy: HostPolicy<TSession>,
	trustedProxy: string | undefined,
	nativeOrigins: readonly string[],
) {
	return Effect.gen(function* () {
		const request = yield* HttpServerRequest.HttpServerRequest;
		if (!localTransport(trustedProxy, nativeOrigins)(request)) {
			return HttpServerResponse.text("Local same-origin requests only", { status: HttpStatus.fromLiteral("Forbidden") });
		}
		if (policy.policy !== "loopback") {
			yield* resolveSession(policy.sessions, Headers.empty, "$connect");
			const session = yield* makeSocketSession(policy.sessions.streamRevalidationInterval ?? "30 seconds");
			return yield* Effect.provideService(handler, SocketSession, session);
		}
		return yield* handler;
	}).pipe(
		Effect.catchTags({
			AuthUnavailable: authUnavailable,
			Forbidden: forbidden,
		}),
	);
}

function authUnavailable() {
	return Effect.succeed(HttpServerResponse.empty({ status: HttpStatus.fromLiteral("ServiceUnavailable") }));
}
function forbidden() {
	return Effect.succeed(HttpServerResponse.empty({ status: HttpStatus.fromLiteral("Forbidden") }));
}
