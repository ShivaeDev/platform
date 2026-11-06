import { Effect, Option, Schema } from "effect";
import { Headers, HttpMiddleware, HttpRouter, HttpServerRequest, HttpServerResponse } from "effect/http";
import * as HttpStatus from "effect/http/HttpStatus";
import { localTransport } from "@shivaedev/identity/server/adapters/local.ts";
import { SessionPolicy } from "@shivaedev/identity/server/SessionPolicy.ts";

export const NativeOrigins = Schema.Array(
	Schema.String.check(
		Schema.makeFilter((origin) => {
			try {
				const url = new URL(origin);
				const authority = url.origin === "null" ? `${url.protocol}//${url.host}` : url.origin;
				return url.host !== "" && !origin.includes("*") && authority === origin;
			} catch {
				return false;
			}
		}),
	),
);

export function nativeClientOrigins(
	origins: readonly string[],
	trustedProxy: string | undefined,
	auth: boolean | "preflight" = false,
	rpcPath: HttpRouter.PathInput = "/rpc",
) {
	const matchesPath = auth ? (path: string) => path === "/api/auth" || path.startsWith("/api/auth/") : (path: string) => path === rpcPath;
	return HttpRouter.middleware((effect) =>
		Effect.gen(function* () {
			const request = yield* HttpServerRequest.HttpServerRequest;
			if (!matchesPath(request.url.split("?")[0] ?? "")) {
				return yield* effect;
			}
			const policy = yield* Effect.serviceOption(SessionPolicy);
			const declared = Option.getOrUndefined(policy)?.origin.trustedOrigins ?? [];
			const allowed = localTransport(trustedProxy, [...origins, ...declared]);
			if ((auth === true || request.method === "OPTIONS") && !allowed(request)) {
				return HttpServerResponse.text("Local same-origin requests only", {
					status: HttpStatus.fromLiteral("Forbidden"),
				});
			}
			return yield* withClientCors(effect, origins, declared, auth !== false);
		}),
	).layer;
}

const withClientCors = Effect.fnUntraced(function* <E, R>(
	effect: Effect.Effect<HttpServerResponse.HttpServerResponse, E, R>,
	nativeOrigins: readonly string[],
	declared: readonly string[],
	auth: boolean,
) {
	const request = yield* HttpServerRequest.HttpServerRequest;
	const origin = request.headers.origin ?? "";
	const native = nativeOrigins.includes(origin);
	const credentialed = !(native || origin.includes("*")) && declared.includes(origin);
	if (!(native || credentialed)) {
		return yield* effect;
	}
	const transport = native ? request.modify({ headers: Headers.remove(request.headers, "cookie") }) : request;
	return yield* HttpMiddleware.cors({
		allowedHeaders: ["Authorization", "Content-Type"],
		allowedMethods: auth ? ["GET", "POST"] : ["POST"],
		allowedOrigins: [origin],
		credentials: credentialed,
		exposedHeaders: auth && native ? ["set-auth-token"] : [],
	})(effect).pipe(Effect.provideService(HttpServerRequest.HttpServerRequest, transport));
});
