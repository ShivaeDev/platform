import { Effect, type Scope } from "effect";
import { Headers, HttpServerRequest, HttpServerResponse } from "effect/http";
import * as HttpStatus from "effect/http/HttpStatus";
import { isAuthUnavailable, isForbidden } from "@shivaedev/errors/taxonomy.ts";
import { localTransport } from "@shivaedev/identity/server/local.ts";
import { resolveSession, type SessionShape } from "@shivaedev/identity/server/session.ts";
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
		}
		return yield* handler;
	}).pipe(Effect.catchIf(isAuthUnavailable, authUnavailable), Effect.catchIf(isForbidden, forbidden));
}

function authUnavailable() {
	return Effect.succeed(HttpServerResponse.empty({ status: HttpStatus.fromLiteral("ServiceUnavailable") }));
}
function forbidden() {
	return Effect.succeed(HttpServerResponse.empty({ status: HttpStatus.fromLiteral("Forbidden") }));
}
