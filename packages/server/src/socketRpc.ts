import { Effect, Option, type Scope } from "effect";
import { Headers, HttpServerRequest, HttpServerResponse } from "effect/http";
import * as HttpStatus from "effect/http/HttpStatus";
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
		const initial = policy.policy === "loopback" ? Option.none() : yield* resolveSession(policy.sessions, Headers.empty, "$connect");
		if (policy.policy === "loopback" || Option.isNone(initial)) {
			return yield* handler;
		}
		const sessions = policy.sessions;
		const monitor = Effect.gen(function* () {
			yield* Effect.sleep(sessions.streamRevalidationInterval ?? "30 seconds");
			const current = yield* resolveSession(sessions, Headers.empty, "$connect");
			return Option.isSome(current) && current.value.user.id === initial.value.user.id;
		}).pipe(Effect.repeat({ while: (valid) => valid }), Effect.as(HttpServerResponse.empty()));
		return yield* Effect.raceFirst(handler, monitor);
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
