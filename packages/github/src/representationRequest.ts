import { HttpClientRequest } from "effect/http";
import { resolveApiUrl } from "#adapters/resolveApiUrl.ts";

export function representationRequest(apiUrl: string, path: string, accept = "application/vnd.github+json") {
	return HttpClientRequest.get(resolveApiUrl(apiUrl, path), { headers: { Accept: accept } });
}
