import { Effect } from "effect";
import { jsonResponse } from "#json.ts";
import type { RepresentationState } from "#RepresentationState.ts";
import { representationRequest } from "#representationRequest.ts";

export function read({ apiUrl, request, responseByteLimit }: RepresentationState) {
	return function readRepresentation(path: string, byteLimit = responseByteLimit) {
		return Effect.map(request(representationRequest(apiUrl, path), byteLimit), jsonResponse);
	};
}
