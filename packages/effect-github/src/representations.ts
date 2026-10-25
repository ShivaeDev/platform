import { Effect, Stream } from "effect";
import { HttpClient, HttpClientRequest, type HttpClientResponse } from "effect/http";
import { paginate } from "@shivaedev/platform/http-client/paginate.ts";
import type { CachedResponse } from "./cache.ts";
import { jsonResponse } from "./json.ts";
import type { requests } from "./requests.ts";

export function representations(apiUrl: string, request: ReturnType<typeof requests>) {
	function get(path: string, accept = "application/vnd.github+json") {
		return HttpClientRequest.get(new URL(path, apiUrl).href, { headers: { Accept: accept } });
	}
	function readRepresentation(path: string) {
		return Effect.map(request(get(path), 1024 * 1024), jsonResponse);
	}
	function listRepresentations(path: string) {
		const entries = new WeakMap<HttpClientResponse.HttpClientResponse, CachedResponse>();
		const client = HttpClient.makeWith(
			(effect: Effect.Effect<HttpClientRequest.HttpClientRequest>) =>
				Effect.flatMap(effect, (input) =>
					Effect.map(request(input, 1024 * 1024), (entry) => {
						entries.set(entry.response, entry);
						return entry.response;
					}),
				),
			Effect.succeed,
		);
		return Effect.succeed(
			paginate(client, get(path)).pipe(
				Stream.mapEffect((response) => Effect.fromNullishOr(entries.get(response))),
				Stream.map(jsonResponse),
			),
		);
	}
	function writeRepresentation(method: "POST" | "PATCH", path: string, body: unknown) {
		return HttpClientRequest.make(method)(new URL(path, apiUrl).href, { headers: { Accept: "application/vnd.github+json" } }).pipe(
			HttpClientRequest.bodyJson(body),
			Effect.flatMap((input) => request(input, 1024 * 1024)),
			Effect.map(jsonResponse),
		);
	}
	return { get, list: listRepresentations, read: readRepresentation, write: writeRepresentation };
}

export type Representations = Omit<ReturnType<typeof representations>, "get">;
