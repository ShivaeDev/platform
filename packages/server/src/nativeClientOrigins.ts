import { Effect, Option } from "effect";
import { Headers, HttpMiddleware, HttpRouter, HttpServerRequest, HttpServerResponse } from "effect/http";
import * as HttpStatus from "effect/http/HttpStatus";
import { accountPreferenceHeaders } from "@shivaedev/identity/accountPreferenceHeaders.ts";
import { localTransport } from "@shivaedev/identity/server/adapters/local.ts";
import { SessionPolicy } from "@shivaedev/identity/server/SessionPolicy.ts";

export function nativeClientOrigins(trustedProxy: string | undefined, route: "auth" | "rpc", rpcPath: HttpRouter.PathInput = "/rpc") {
	const auth = route === "auth";
	const matchesPath = auth ? (path: string) => path === "/api/auth" || path.startsWith("/api/auth/") : (path: string) => path === rpcPath;
	return HttpRouter.middleware((effect) =>
		Effect.gen(function* () {
			const request = yield* HttpServerRequest.HttpServerRequest;
			if (!matchesPath(request.url.split("?")[0] ?? "")) {
				return yield* effect;
			}
			const policy = Option.getOrUndefined(yield* Effect.serviceOption(SessionPolicy));
			const native = policy?.nativeOrigins ?? [];
			const declared = policy?.origin.trustedOrigins ?? [];
			const allowed = localTransport(trustedProxy, [...native, ...declared]);
			const guarded = request.method === "OPTIONS" || (auth && policy?.nativeOrigins !== undefined);
			if (guarded && !allowed(request)) {
				return HttpServerResponse.text("Local same-origin requests only", {
					status: HttpStatus.fromLiteral("Forbidden"),
				});
			}
			return yield* withClientCors(effect, native, declared, auth);
		}),
	).layer;
}

const CLIENT_HEADERS = ["Authorization", "Content-Type"];

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
		allowedHeaders: auth ? [...CLIENT_HEADERS, ...Object.values(accountPreferenceHeaders)] : CLIENT_HEADERS,
		allowedMethods: auth ? ["GET", "POST"] : ["POST"],
		allowedOrigins: [origin],
		credentials: credentialed,
		exposedHeaders: auth && native ? ["set-auth-token"] : [],
	})(effect).pipe(Effect.provideService(HttpServerRequest.HttpServerRequest, transport));
});
