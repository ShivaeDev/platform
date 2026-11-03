import { HttpClientResponse } from "effect/http";

export function mergeResponseHeaders(cached: HttpClientResponse.HttpClientResponse, response: HttpClientResponse.HttpClientResponse) {
	return HttpClientResponse.fromWeb(
		response.request,
		new Response(null, { headers: { ...cached.headers, ...response.headers }, status: response.status }),
	);
}
