import { Effect, Exit, Scope } from "effect";
import * as HttpStatus from "effect/http/HttpStatus";
import { otlpReceiver as makeReceiver } from "@shivaedev/test-story/server/otlpReceiver.ts";

export async function otlpReceiver(
	status: number | ((attempt: number) => number | undefined) = HttpStatus.fromLiteral("OK"),
	answer: string | null = "{}",
	path = "/v1/traces",
) {
	const waiters: (() => void)[] = [];
	function received(attempt: number) {
		queueMicrotask(() => {
			for (const waiter of waiters.splice(0)) {
				waiter();
			}
		});
		return typeof status === "function" ? status(attempt) : status;
	}
	const scope = Effect.runSync(Scope.make());
	const receiver = await Effect.runPromise(makeReceiver({ answer, path, status: received }).pipe(Scope.provide(scope)));
	function exports() {
		return receiver.requests.map(({ body, headers, path: requestPath }) => ({
			body: body.toString(),
			bytes: body,
			contentType: headers["content-type"]?.toString(),
			path: requestPath,
			token: headers["x-collector-token"]?.toString(),
		}));
	}
	return {
		close: () => Effect.runPromise(Scope.close(scope, Exit.void)),
		get requests() {
			return exports();
		},
		spans: receiver.spans,
		url: receiver.url,
		whenReceived: (condition: (requests: ReturnType<typeof exports>) => boolean) =>
			new Promise<void>((resolve) => {
				function check() {
					if (condition(exports())) {
						resolve();
					} else {
						waiters.push(check);
					}
				}
				check();
			}),
	};
}
