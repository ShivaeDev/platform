import { type Cause, Effect } from "effect";
import type { RoleSet } from "@shivaedev/access/roleSet.ts";
import { type BearerSessionsOptions, cookieSessionResponse, hasSessionCookie, sessionHeaders } from "#server/better-auth/bearerSessions.ts";
import { sessionPermissions } from "#server/better-auth/sessionPermissions.ts";

export interface MountedAuth {
	readonly $context: Promise<{ readonly authCookies: { readonly sessionToken: { readonly name: string } } }>;
	readonly handler: (request: Request) => Promise<Response>;
}
export interface MountRouteOptions {
	readonly bearerSessions?: BearerSessionsOptions | undefined;
	readonly clientIpHeader: string;
	readonly ipv6Subnet?: number | undefined;
	readonly roles?: RoleSet | undefined;
	readonly runRequest?: (<A>(request: (signal: AbortSignal) => Promise<A>) => Effect.Effect<A, Cause.UnknownError>) | undefined;
	readonly trustedProxy?: string | undefined;
}
function replacesSession(request: Request, reply: Response, native: boolean) {
	return (
		native
		&& reply.ok
		&& reply.headers.has("set-auth-token")
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
	const reply = await auth.handler(request);
	if (replacesSession(request, reply, native)) {
		const revoked = await auth.handler(new Request(new URL("/api/auth/sign-out", web.url), { body: "{}", headers, method: "POST" }));
		await revoked.body?.cancel();
		if (!revoked.ok) {
			throw new Error("Session replacement failed");
		}
	}
	return native ? reply : cookieSessionResponse(reply);
}
export const response = Effect.fnUntraced(function* (auth: MountedAuth, web: Request, options: MountRouteOptions) {
	const sessionRequest = options.roles !== undefined && new URL(web.url).pathname === "/api/auth/get-session";
	const url = new URL(web.url);
	if (sessionRequest) {
		url.searchParams.set("disableCookieCache", "true");
	}
	const request = sessionRequest ? new Request(url, web) : web;
	const runRequest = options.runRequest ?? Effect.tryPromise;
	const reply = yield* runRequest((signal) => providerResponse(auth, new Request(request, { signal }), options));
	return sessionRequest && reply.ok && options.roles !== undefined ? yield* sessionPermissions(reply, options.roles) : reply;
});
