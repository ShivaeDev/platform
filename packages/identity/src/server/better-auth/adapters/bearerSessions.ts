import type { BetterAuthOptions } from "better-auth";
import { bearer } from "better-auth/plugins/bearer";
import { Result } from "effect";

export interface BearerSessionsOptions {
	readonly origins: readonly string[];
}

export function withBearerSessions<TOptions extends BetterAuthOptions>(options: TOptions, enabled: boolean): TOptions {
	return enabled ? { ...options, plugins: [...(options.plugins ?? []), bearer({ requireSignature: true })] } : options;
}

export function hasSessionCookie(headers: Headers, cookieName: string): boolean {
	return (
		headers
			.get("cookie")
			?.split(";")
			.some((cookie) => cookie.trim().startsWith(`${cookieName}=`)) === true
	);
}

export function sessionHeaders(headers: Headers, cookieName: string): Headers {
	const result = new Headers(headers);
	if (hasSessionCookie(headers, cookieName)) {
		result.delete("authorization");
	} else if (/^bearer\s/iu.test(headers.get("authorization") ?? "")) {
		result.delete("cookie");
	}
	return result;
}

export async function cookieSessionResponse(response: Response): Promise<Response> {
	const headers = new Headers(response.headers);
	headers.delete("set-auth-token");
	const exposed = headers.get("access-control-expose-headers");
	if (exposed !== null) {
		headers.set(
			"access-control-expose-headers",
			exposed
				.split(",")
				.filter((header) => header.trim().toLowerCase() !== "set-auth-token")
				.join(","),
		);
	}
	const init = { headers, status: response.status, statusText: response.statusText };
	if ((response.status >= 300 && response.status < 400) || response.body === null || !headers.get("content-type")?.includes("application/json")) {
		return new Response(response.body, init);
	}
	const bytes = await response.arrayBuffer();
	const body = Result.try((): unknown => JSON.parse(new TextDecoder().decode(bytes), (key, value: unknown) => (key === "token" ? undefined : value)));
	if (Result.isFailure(body)) {
		return new Response(bytes, init);
	}
	headers.delete("content-length");
	return Response.json(body.success, init);
}
