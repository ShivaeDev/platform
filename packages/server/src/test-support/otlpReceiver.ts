import { Effect, Exit, Scope } from "effect";
import * as HttpStatus from "effect/http/HttpStatus";
import { otlpReceiver as makeReceiver } from "@shivaedev/test-story/server/otlpReceiver.ts";

export async function otlpReceiver(
	status: number | ((attempt: number) => number | undefined) = HttpStatus.fromLiteral("OK"),
	answer: string | null = "{}",
	path = "/v1/traces",
) {
	const scope = Effect.runSync(Scope.make());
	const receiver = await Effect.runPromise(makeReceiver({ answer, path, status }).pipe(Scope.provide(scope)));
	return {
		close: () => Effect.runPromise(Scope.close(scope, Exit.void)),
		get requests() {
			return receiver.requests.map(({ body, headers, path: requestPath }) => ({
				body: body.toString(),
				bytes: body,
				contentType: headers["content-type"],
				path: requestPath,
				token: headers["x-collector-token"]?.toString(),
			}));
		},
		spans: receiver.spans,
		url: receiver.url,
	};
}
