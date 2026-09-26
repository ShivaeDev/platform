import { Effect, Option } from "effect";
import type { HttpServerRequest, HttpServerResponse } from "effect/unstable/http";
import { respond } from "./respond.ts";

const LOOPBACK_NAMES = new Set(["127.0.0.1", "localhost", "[::1]"]);

const hostnameOf = (host: string): string | undefined => {
	try {
		return new URL(`http://${host}/`).hostname;
	} catch {
		return undefined;
	}
};

const loopbackAddress = (address: string): boolean => {
	const unmapped = address.replace(/^::ffff:/i, "");
	return unmapped === "::1" || /^127(?:\.\d{1,3}){3}$/.test(unmapped);
};

const fromLoopback = (request: HttpServerRequest.HttpServerRequest): boolean => {
	const host = request.headers.host;
	const addressed = host !== undefined && LOOPBACK_NAMES.has(hostnameOf(host) ?? "");
	return addressed && Option.match(request.remoteAddress, { onNone: () => true, onSome: loopbackAddress });
};

export const loopbackOnly =
	<E, R>(handler: (request: HttpServerRequest.HttpServerRequest) => Effect.Effect<HttpServerResponse.HttpServerResponse, E, R>) =>
	(request: HttpServerRequest.HttpServerRequest) =>
		fromLoopback(request) ? handler(request) : Effect.succeed(respond("Only loopback hosts are served", "text/plain", 403));
