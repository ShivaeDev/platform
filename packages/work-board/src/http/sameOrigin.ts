import type { HttpServerRequest } from "effect/unstable/http";

export function sameOrigin(request: HttpServerRequest.HttpServerRequest): boolean {
	const origin = request.headers.origin;
	if (origin === undefined) {
		return true;
	}
	try {
		const url = new URL(origin);
		return url.protocol === "http:" && url.host === request.headers.host;
	} catch {
		return false;
	}
}
