import { Effect, type Scope } from "effect";
import { Headers, HttpServerRequest, HttpServerResponse } from "effect/http";
import * as HttpStatus from "effect/http/HttpStatus";
import { isAuthUnavailable, isForbidden } from "@shivaedev/errors/taxonomy.ts";
import { localTransport } from "@shivaedev/identity/server/local.ts";
import { SessionPolicy } from "@shivaedev/identity/server/SessionPolicy.ts";
import { resolveSession } from "@shivaedev/identity/server/session.ts";
import { makeSocketSession, SocketSession } from "@shivaedev/identity/server/socketSession.ts";
import { bearerSocketRpc } from "#bearerSocketRpc.ts";
import type { HostPolicy } from "#hostOptions.ts";

export function socketRpc(
	handler: Effect.Effect<HttpServerResponse.HttpServerResponse, never, HttpServerRequest.HttpServerRequest | Scope.Scope>,
	policy: Extract<HostPolicy, { readonly policy: "loopback" }>,
	trustedProxy: string | undefined,
	nativeOrigins: readonly string[],
): Effect.Effect<HttpServerResponse.HttpServerResponse, never, HttpServerRequest.HttpServerRequest | Scope.Scope>;
export function socketRpc(
	handler: Effect.Effect<HttpServerResponse.HttpServerResponse, never, HttpServerRequest.HttpServerRequest | Scope.Scope>,
	policy: HostPolicy,
	trustedProxy: string | undefined,
	nativeOrigins: readonly string[],
): Effect.Effect<HttpServerResponse.HttpServerResponse, never, HttpServerRequest.HttpServerRequest | Scope.Scope | SessionPolicy>;
export function socketRpc(
	handler: Effect.Effect<HttpServerResponse.HttpServerResponse, never, HttpServerRequest.HttpServerRequest | Scope.Scope>,
	policy: HostPolicy,
	trustedProxy: string | undefined,
	nativeOrigins: readonly string[],
) {
	return Effect.gen(function* () {
		const request = yield* HttpServerRequest.HttpServerRequest;
		if (!localTransport(trustedProxy, nativeOrigins)(request)) {
			return HttpServerResponse.text("Local same-origin requests only", { status: HttpStatus.fromLiteral("Forbidden") });
		}
		if (policy.policy !== "loopback") {
			if (new URL(request.url, "http://localhost").searchParams.get("auth") === "frame") {
				return yield* bearerSocketRpc(handler);
			}
			yield* resolveSession(Headers.empty, "$connect");
			const session = yield* makeSocketSession((yield* SessionPolicy).streamRevalidationInterval ?? "30 seconds");
			return yield* Effect.provideService(handler, SocketSession, session);
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
