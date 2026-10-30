import { Effect, Option } from "effect";
import { HttpServerRequest, HttpServerResponse, HttpTraceContext } from "effect/http";
import * as HttpStatus from "effect/http/HttpStatus";
import { RpcSerialization } from "effect/rpc";
import { proxyAddresses, proxyMatches } from "./trustedProxy.ts";
import { trustedProxyRanges as normalizedRanges } from "./trustedProxyRanges.ts";

type TransportRequest = Pick<HttpServerRequest.HttpServerRequest, "headers" | "remoteAddress">;

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
export function sameOrigin(request: Pick<TransportRequest, "headers">): boolean {
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
			: Effect.succeed(HttpServerResponse.text("Only loopback hosts are served", { status: HttpStatus.fromLiteral("Forbidden") }));
}
export function trustedProxyPeer(trustedProxy?: string): (address: string) => boolean {
	const addresses = trustedProxy === undefined ? undefined : proxyAddresses(trustedProxy);
	return (address) => addresses !== undefined && proxyMatches(addresses, address);
}
export function trustedProxyRanges(trustedProxy?: string): string[] {
	return normalizedRanges(trustedProxy);
}

function proxyOrigin(request: TransportRequest, isTrustedProxy: (address: string) => boolean, native: boolean): boolean {
	if (!Option.exists(request.remoteAddress, isTrustedProxy)) {
		return false;
	}
	const host = request.headers["x-forwarded-host"];
	const protocol = request.headers["x-forwarded-proto"];
	if (host === undefined || !/^(?:\[[\da-f:]+\]|[\da-z.-]+)(?::\d{1,5})?$/iu.test(host) || (protocol !== "http" && protocol !== "https")) {
		return false;
	}
	try {
		const url = new URL(`${protocol}://${host}`);
		return native || request.headers.origin === undefined || request.headers.origin === url.origin;
	} catch {
		return false;
	}
}
export function localTransport(trustedProxy?: string, nativeOrigins: readonly string[] = []) {
	const isTrustedProxy = trustedProxyPeer(trustedProxy);
	return (request: TransportRequest): boolean => {
		const native = nativeOrigins.includes(request.headers.origin ?? "");
		const local = loopbackHost(request.headers.host) && Option.exists(request.remoteAddress, loopbackAddress);
		return (local && (native || sameOrigin(request))) || proxyOrigin(request, isTrustedProxy, native);
	};
}
export function localRpcGuard<E, R>(
	effect: Effect.Effect<HttpServerResponse.HttpServerResponse, E, R>,
	trustedProxy?: string,
	nativeOrigins: readonly string[] = [],
) {
	const allowed = localTransport(trustedProxy, nativeOrigins);
	return Effect.gen(function* () {
		const request = yield* HttpServerRequest.HttpServerRequest;
		const serialization = yield* RpcSerialization.RpcSerialization;
		const contentType = request.headers["content-type"]?.split(";")[0]?.trim().toLowerCase();
		const legacyNdjson = serialization.contentType === RpcSerialization.ndjson.contentType && contentType === "application/ndjson";
		return allowed(request) && (contentType === serialization.contentType || legacyNdjson)
			? yield* continueHttpTrace(effect, request)
			: HttpServerResponse.text("Local same-origin requests only", { status: HttpStatus.fromLiteral("Forbidden") });
	});
}

const continueHttpTrace = Effect.fnUntraced(function* <A, E, R>(effect: Effect.Effect<A, E, R>, request: HttpServerRequest.HttpServerRequest) {
	const incoming = HttpTraceContext.w3c(request.headers);
	if (Option.isNone(incoming)) {
		return yield* effect;
	}
	const parent = Option.getOrElse(yield* Effect.option(Effect.currentParentSpan), () => incoming.value);
	return yield* Effect.withParentSpan(effect, parent);
});
