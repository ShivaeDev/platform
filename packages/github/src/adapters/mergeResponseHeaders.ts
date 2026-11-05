import { HttpClientResponse } from "effect/http";

export function mergeResponseHeaders(cached: HttpClientResponse.HttpClientResponse["headers"], response: HttpClientResponse.HttpClientResponse) {
	return HttpClientResponse.fromWeb(response.request, new Response(null, { headers: { ...cached, ...response.headers }, status: response.status }));
}
