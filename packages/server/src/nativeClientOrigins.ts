import { Effect, Schema } from "effect";
import { Headers, HttpMiddleware, HttpRouter, HttpServerRequest, HttpServerResponse } from "effect/http";
import * as HttpStatus from "effect/http/HttpStatus";
import { localTransport } from "@shivaedev/identity/server/local.ts";

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

export function nativeClientOrigins(origins: readonly string[], trustedProxy: string | undefined, auth = false) {
	const allowed = localTransport(trustedProxy, origins);
	const cors = HttpMiddleware.cors({
		allowedHeaders: ["Authorization", "Content-Type"],
		allowedMethods: auth ? ["GET", "POST"] : ["POST"],
		allowedOrigins: (origin) => origins.includes(origin),
		credentials: false,
		exposedHeaders: auth ? ["set-auth-token"] : [],
	});
	return HttpRouter.middleware((effect) =>
		Effect.gen(function* () {
			const request = yield* HttpServerRequest.HttpServerRequest;
			if (auth && !request.url.split("?")[0]?.startsWith("/api/auth/")) {
				return yield* effect;
			}
			if ((auth || request.method === "OPTIONS") && !allowed(request)) {
				return HttpServerResponse.text("Local same-origin requests only", { status: HttpStatus.fromLiteral("Forbidden") });
			}
			if (!origins.includes(request.headers.origin ?? "")) {
				return yield* effect;
			}
			const native = request.modify({ headers: Headers.remove(request.headers, "cookie") });
			return yield* cors(effect).pipe(Effect.provideService(HttpServerRequest.HttpServerRequest, native));
		}),
	).layer;
}
