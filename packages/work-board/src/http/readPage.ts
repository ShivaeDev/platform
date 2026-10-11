import type { Effect } from "effect";
import { HttpServerRequest, type HttpServerResponse } from "effect/unstable/http";

export function readPage<E, R>(
	routes: Readonly<Record<string, (request: HttpServerRequest.HttpServerRequest) => Effect.Effect<HttpServerResponse.HttpServerResponse, E, R>>>,
	fallback: (request: HttpServerRequest.HttpServerRequest) => Effect.Effect<HttpServerResponse.HttpServerResponse, E, R>,
) {
	return (url: string) => {
		const request = HttpServerRequest.fromWeb(new Request(`http://127.0.0.1${url}`));
		const path = new URL(url, "http://127.0.0.1").pathname;
		return (routes[path] ?? fallback)(request);
	};
}
