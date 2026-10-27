import { Effect } from "effect";
import { HttpRouter, HttpServerRequest, HttpServerResponse } from "effect/http";
import type { RoleSet } from "@shivaedev/access/roleSet.ts";
import { redact } from "@shivaedev/errors/redact.ts";
import { type BearerSessionsOptions, cookieSessionResponse, hasSessionCookie, sessionHeaders } from "#server/better-auth/bearerSessions.ts";
import { clientIpHeaders } from "./clientIp.ts";
import { sessionPermissions } from "./sessionPermissions.ts";

interface MountedAuth {
	readonly $context: Promise<{ readonly authCookies: { readonly sessionToken: { readonly name: string } } }>;
	readonly handler: (request: Request) => Promise<Response>;
}
interface MountRouteOptions {
	readonly bearerSessions?: BearerSessionsOptions | undefined;
	readonly clientIpHeader: string;
	readonly ipv6Subnet?: number | undefined;
	readonly roles?: RoleSet | undefined;
	readonly trustedProxy?: string | undefined;
}
function replacesSession(request: Request, response: Response, native: boolean) {
	return (
		native
		&& response.ok
		&& response.headers.has("set-auth-token")
		&& request.headers.has("authorization")
		&& new URL(request.url).pathname.startsWith("/api/auth/sign-in/")
	);
}
async function providerResponse(auth: MountedAuth, web: Request, options: MountRouteOptions) {
	if (options.bearerSessions === undefined) {
		return auth.handler(web);
	}
	const { authCookies } = await auth.$context;
	const cookieName = authCookies.sessionToken.name;
	const headers = sessionHeaders(web.headers, cookieName);
	const native = options.bearerSessions.origins.includes(web.headers.get("origin") ?? "") && !hasSessionCookie(web.headers, cookieName);
	const request = new Request(web, { headers });
	const response = await auth.handler(request);
	if (replacesSession(request, response, native)) {
		const revoked = await auth.handler(new Request(new URL("/api/auth/sign-out", web.url), { body: "{}", headers, method: "POST" }));
		await revoked.body?.cancel();
		if (!revoked.ok) {
			throw new Error("Session replacement failed");
		}
	}
	return native ? response : cookieSessionResponse(response);
}
async function authResponse(auth: MountedAuth, web: Request, options: MountRouteOptions) {
	const sessionRequest = options.roles !== undefined && new URL(web.url).pathname === "/api/auth/get-session";
	const url = new URL(web.url);
	if (sessionRequest) {
		url.searchParams.set("disableCookieCache", "true");
	}
	const request = sessionRequest ? new Request(url, web) : web;
	const response = await providerResponse(auth, request, options);
	return sessionRequest && response.ok && options.roles !== undefined ? sessionPermissions(response, options.roles) : response;
}
export function mountRoutes(auth: MountedAuth, options: MountRouteOptions) {
	const setClientIp = clientIpHeaders(options);
	return HttpRouter.use((router) =>
		router.add("*", "/api/auth/*", (request) =>
			Effect.gen(function* () {
				const web = yield* HttpServerRequest.toWeb(request);
				setClientIp(request, web);
				return HttpServerResponse.fromWeb(
					yield* Effect.tryPromise(() => authResponse(auth, web, options)).pipe(
						Effect.tapError((error) => Effect.logError("Authentication provider failed", redact(error.cause))),
					),
				);
			}).pipe(Effect.catch(() => Effect.succeed(HttpServerResponse.text("Authentication is temporarily unavailable", { status: 503 })))),
		),
	);
}
