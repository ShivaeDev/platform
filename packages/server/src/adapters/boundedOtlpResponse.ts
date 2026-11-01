import { Effect } from "effect";
import { HttpClientError, HttpClientResponse } from "effect/http";
import { readBoundedBody } from "@shivaedev/http/body.ts";

const responseLimit = 64 * 1024;

export const boundedOtlpResponse = Effect.fnUntraced(function* (response: HttpClientResponse.HttpClientResponse) {
	const bytes = yield* readBoundedBody(response, responseLimit).pipe(
		Effect.mapError((error) =>
			HttpClientError.isHttpClientError(error)
				? error
				: new HttpClientError.HttpClientError({
						reason: new HttpClientError.DecodeError({
							description: `OTLP collector response exceeds ${responseLimit} bytes`,
							request: response.request,
							response,
						}),
					}),
		),
	);
	const buffered = HttpClientResponse.fromWeb(
		response.request,
		new Response(bytes.byteLength === 0 ? null : bytes, { headers: response.headers, status: response.status }),
	);
	yield* buffered.arrayBuffer;
	return buffered;
});
