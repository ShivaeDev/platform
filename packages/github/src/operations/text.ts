import { Effect } from "effect";
import type { RepresentationState } from "#RepresentationState.ts";
import { representationRequest } from "#representationRequest.ts";

export function text({ apiUrl, request }: RepresentationState) {
	return (path: string, accept: string, limit: number) =>
		Effect.map(request(representationRequest(apiUrl, path, accept), limit), (entry) => new TextDecoder().decode(entry.bytes));
}
