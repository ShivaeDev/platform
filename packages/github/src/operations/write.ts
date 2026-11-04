import { Effect } from "effect";
import { HttpClientRequest } from "effect/http";
import { resolveApiUrl } from "#adapters/resolveApiUrl.ts";
import { jsonResponse } from "#json.ts";
import type { RepresentationState } from "#RepresentationState.ts";

export function write({ apiUrl, request, responseByteLimit }: RepresentationState) {
	return function writeRepresentation(method: "POST" | "PATCH" | "PUT" | "DELETE", path: string, body?: unknown, byteLimit = responseByteLimit) {
		return HttpClientRequest.make(method)(resolveApiUrl(apiUrl, path), { headers: { Accept: "application/vnd.github+json" } }).pipe(
			(input) => (body === undefined ? Effect.succeed(input) : HttpClientRequest.bodyJson(input, body)),
			Effect.flatMap((input) => request(input, byteLimit)),
			Effect.map(jsonResponse),
		);
	};
}
