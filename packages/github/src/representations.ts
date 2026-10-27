import { Effect, Stream } from "effect";
import { HttpClient, HttpClientRequest, type HttpClientResponse } from "effect/http";
import type { ServiceUnavailable } from "@shivaedev/errors/taxonomy.ts";
import { nextLink } from "@shivaedev/http/nextLink.ts";
import { paginate } from "@shivaedev/http/paginate.ts";
import type { CachedResponse } from "#cache.ts";
import { jsonResponse } from "#json.ts";
import type { requests } from "#requests.ts";

export function representations(
	apiUrl: string,
	request: ReturnType<typeof requests>,
	resource: (path: string) => string,
	responseByteLimit = 1024 * 1024,
) {
	function get(path: string, accept = "application/vnd.github+json") {
		return HttpClientRequest.get(new URL(path, apiUrl).href, { headers: { Accept: accept } });
	}
	function readRepresentation(path: string, byteLimit = responseByteLimit) {
		return Effect.map(request(get(path), byteLimit), jsonResponse);
	}
	function listRepresentations(
		path: string,
		beforeRequest?: (resource: string) => Effect.Effect<void, ServiceUnavailable>,
		byteLimit = responseByteLimit,
	) {
		const entries = new WeakMap<HttpClientResponse.HttpClientResponse, CachedResponse>();
		function fetchPage(input: HttpClientRequest.HttpClientRequest) {
			return (beforeRequest?.(resource(new URL(input.url).pathname)) ?? Effect.void).pipe(
				Effect.andThen(request(input, byteLimit)),
				Effect.map((entry) => {
					entries.set(entry.response, entry);
					return entry.response;
				}),
			);
		}
		const client = HttpClient.makeWith(
			(effect: Effect.Effect<HttpClientRequest.HttpClientRequest>) => Effect.flatMap(effect, fetchPage),
			Effect.succeed,
		);
		return Effect.succeed(
			paginate(client, get(path)).pipe(
				Stream.mapEffect((response) => Effect.fromNullishOr(entries.get(response))),
				Stream.map((entry) => ({ ...jsonResponse(entry), hasNext: nextLink(entry.response.headers.link) !== undefined })),
			),
		);
	}
	function writeRepresentation(method: "POST" | "PATCH", path: string, body: unknown, byteLimit = responseByteLimit) {
		return HttpClientRequest.make(method)(new URL(path, apiUrl).href, { headers: { Accept: "application/vnd.github+json" } }).pipe(
			HttpClientRequest.bodyJson(body),
			Effect.flatMap((input) => request(input, byteLimit)),
			Effect.map(jsonResponse),
		);
	}
	return { get, list: listRepresentations, read: readRepresentation, write: writeRepresentation };
}

export type Representations = Omit<ReturnType<typeof representations>, "get">;
