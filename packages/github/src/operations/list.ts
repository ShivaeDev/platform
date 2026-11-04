import { Effect, Stream } from "effect";
import { HttpClient, type HttpClientRequest, type HttpClientResponse } from "effect/http";
import type { ServiceUnavailable } from "@shivaedev/errors/taxonomy.ts";
import { nextLink } from "@shivaedev/http/nextLink.ts";
import { paginate } from "@shivaedev/http/paginate.ts";
import type { CachedResponse } from "#cache.ts";
import { jsonResponse } from "#json.ts";
import type { RepresentationState } from "#RepresentationState.ts";
import { representationRequest } from "#representationRequest.ts";

export function list({ apiUrl, request, resource, responseByteLimit }: RepresentationState) {
	return function listRepresentations<E = ServiceUnavailable>(
		path: string,
		beforeRequest?: (resource: string) => Effect.Effect<void, E>,
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
			paginate(client, representationRequest(apiUrl, path)).pipe(
				Stream.mapEffect((response) => Effect.fromNullishOr(entries.get(response))),
				Stream.map((entry) => ({ ...jsonResponse(entry), hasNext: nextLink(entry.response.headers.link) !== undefined })),
			),
		);
	};
}
