import { betterAuth } from "better-auth";
import { Config, Effect, Redacted } from "effect";
import { HttpRouter, HttpServerRequest, HttpServerResponse } from "effect/unstable/http";
import { betterAuthSessions } from "@shivaedev/platform/rpc-server/adapters/better-auth-sessions.ts";
import { authDatabase } from "./authDatabase.ts";

export const makeAuth = Effect.fn("Starter.makeAuth")(function* (config: {
	readonly databaseUrl: Redacted.Redacted<string>;
	readonly secret?: Redacted.Redacted<string>;
}) {
	const secret = config.secret ?? (yield* Config.redacted("BETTER_AUTH_SECRET"));
	const pool = yield* authDatabase(config.databaseUrl);
	const auth = betterAuth({
		"baseURL": { allowedHosts: ["127.0.0.1:*"], protocol: "http" },
		database: pool,
		emailAndPassword: { enabled: true },
		secret: Redacted.value(secret),
		session: { cookieCache: { enabled: false } },
		trustedOrigins: ["http://127.0.0.1:*"],
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
		auth,
		routes,
		sessions: {
			origin: ({ headers }: { readonly headers: Readonly<Record<string, string>> }) =>
				headers.origin === undefined || headers.origin === `http://${headers.host}`,
			provider: betterAuthSessions((headers) => auth.api.getSession({ headers })),
		},
	};
});

export type StarterAuth = Effect.Success<ReturnType<typeof makeAuth>>["auth"];
