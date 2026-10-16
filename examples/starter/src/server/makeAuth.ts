import { betterAuth } from "better-auth";
import { Config, Effect, Option, Redacted } from "effect";
import { HttpRouter, HttpServerRequest, HttpServerResponse } from "effect/http";
import type { Pool } from "pg";
import { betterAuthSessions } from "@shivaedev/platform/rpc-server/adapters/better-auth-sessions.ts";
import { authOptions } from "./authOptions.ts";

export const makeAuth = Effect.fn("Starter.makeAuth")(function* (config: { readonly database: Pool; readonly secret?: Redacted.Redacted<string> }) {
	const secret = config.secret ?? (yield* Config.Redacted("BETTER_AUTH_SECRET"));
	const publicUrl = yield* Config.URL("PUBLIC_URL").pipe(Config.option);
	const origin = Option.map(publicUrl, (url) => url.origin);
	const auth = betterAuth({
		advanced: { useSecureCookies: Option.isSome(publicUrl) && publicUrl.value.protocol === "https:" },
		"baseURL": Option.getOrElse(origin, () => ({ allowedHosts: ["127.0.0.1:*"], protocol: "http" as const })),
		...authOptions(config.database),
		secret: Redacted.value(secret),
		session: { cookieCache: { enabled: false } },
		trustedOrigins: [Option.getOrElse(origin, () => "http://127.0.0.1:*")],
	});
	const routes = HttpRouter.use((router) =>
		router.add("*", "/api/auth/*", (request) =>
			Effect.gen(function* () {
				const web = yield* HttpServerRequest.toWeb(request);
				return HttpServerResponse.fromWeb(yield* Effect.tryPromise(() => auth.handler(web)));
			}).pipe(Effect.catch(() => Effect.succeed(HttpServerResponse.text("Authentication is temporarily unavailable", { status: 503 })))),
		),
	);
	return {
		routes,
		sessions: {
			origin: ({ headers }: { readonly headers: Readonly<Record<string, string>> }) =>
				headers.origin === undefined || headers.origin === Option.getOrElse(origin, () => `http://${headers.host}`),
			provider: betterAuthSessions((headers) => auth.api.getSession({ headers })),
		},
	};
});
