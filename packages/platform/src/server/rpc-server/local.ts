import { Effect, Option } from "effect";
import { HttpServerRequest, HttpServerResponse } from "effect/unstable/http";
import { RpcSerialization } from "effect/unstable/rpc";

function loopbackAddress(address: string): boolean {
	const unmapped = unmapAddress(address);
	return unmapped === "::1" || (/^127(?:\.\d{1,3}){3}$/u.test(unmapped) && unmapped.split(".").every((part) => Number(part) <= 255));
}
function unmapAddress(address: string): string {
	return address.replace(/^::ffff:/iu, "");
}
function loopbackHost(host: string | undefined): boolean {
	if (host === undefined) {
		return false;
	}
	const authority = /^(?<hostname>\[[^\]]+\]|[^:]+)(?::(?<port>\d{1,5}))?$/u.exec(host)?.groups;
	if (authority === undefined || (authority.port !== undefined && Number(authority.port) > 65_535)) {
		return false;
	}
	const hostname = authority.hostname?.toLowerCase();
	return hostname !== undefined && (hostname === "localhost" || hostname === "[::1]" || loopbackAddress(hostname));
}
export function sameOrigin(request: HttpServerRequest.HttpServerRequest): boolean {
	const origin = request.headers.origin;
	if (origin === undefined) {
		return true;
	}
	try {
		const url = new URL(origin);
		return url.protocol === "http:" && url.origin === origin && url.host === request.headers.host;
	} catch {
		return false;
	}
}
export function loopbackOnly<E, R>(
	handler: (request: HttpServerRequest.HttpServerRequest) => Effect.Effect<HttpServerResponse.HttpServerResponse, E, R>,
) {
	return (request: HttpServerRequest.HttpServerRequest) =>
		loopbackHost(request.headers.host) && Option.match(request.remoteAddress, { onNone: () => true, onSome: loopbackAddress })
			? handler(request)
			: Effect.succeed(HttpServerResponse.text("Only loopback hosts are served", { status: 403 }));
}
function proxyOrigin(request: HttpServerRequest.HttpServerRequest, trustedProxy: string | undefined): boolean {
	if (trustedProxy === undefined || !Option.exists(request.remoteAddress, (address) => unmapAddress(address) === unmapAddress(trustedProxy))) {
		return false;
	}
	const host = request.headers["x-forwarded-host"];
	const protocol = request.headers["x-forwarded-proto"];
	if (host === undefined || !/^(?:\[[\da-f:]+\]|[\da-z.-]+)(?::\d{1,5})?$/iu.test(host) || (protocol !== "http" && protocol !== "https")) {
		return false;
	}
	try {
		const url = new URL(`${protocol}://${host}`);
		return request.headers.origin === undefined || request.headers.origin === url.origin;
	} catch {
		return false;
	}
}
export const localRpcGuard = Effect.fnUntraced(function* <E, R>(
	effect: Effect.Effect<HttpServerResponse.HttpServerResponse, E, R>,
	trustedProxy?: string,
) {
	const request = yield* HttpServerRequest.HttpServerRequest;
	const serialization = yield* RpcSerialization.RpcSerialization;
	const local = loopbackHost(request.headers.host) && Option.exists(request.remoteAddress, loopbackAddress);
	const contentType = request.headers["content-type"]?.split(";")[0]?.trim().toLowerCase();
	return ((local && sameOrigin(request)) || proxyOrigin(request, trustedProxy)) && contentType === serialization.contentType
		? yield* effect
		: HttpServerResponse.text("Local same-origin requests only", { status: 403 });
});
