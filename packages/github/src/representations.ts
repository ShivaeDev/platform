import type { Effect } from "effect";
import { list } from "#operations/list.ts";
import { read } from "#operations/read.ts";
import { write } from "#operations/write.ts";
import { representationRequest } from "#representationRequest.ts";
import type { requests } from "#requests.ts";

export function representations(
	apiUrl: string,
	request: Effect.Success<ReturnType<typeof requests>>,
	resource: (path: string) => string,
	responseByteLimit = 1024 * 1024,
) {
	const state = { apiUrl, request, resource, responseByteLimit };
	return {
		get: (path: string, accept = "application/vnd.github+json") => representationRequest(apiUrl, path, accept),
		list: list(state),
		read: read(state),
		write: write(state),
	};
}

export type Representations = Omit<ReturnType<typeof representations>, "get">;
