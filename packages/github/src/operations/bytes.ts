import { Effect } from "effect";
import type { RepresentationState } from "#RepresentationState.ts";
import { representationRequest } from "#representationRequest.ts";

export function bytes({ apiUrl, request }: RepresentationState) {
	return (path: string, accept: string, limit: number) =>
		Effect.map(request(representationRequest(apiUrl, path, accept), limit), (entry) => entry.bytes);
}
