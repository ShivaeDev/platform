import { Clock, Effect } from "effect";
import { SecureRandom } from "effect/crypto/SecureRandom";
import { HttpEffect, HttpRouter, HttpServerRequest } from "effect/http";

function responseLogger(started: number, annotations: Readonly<Record<string, string>>): HttpEffect.PreResponseHandler {
	return (_request, response) =>
		Effect.gen(function* () {
			const finished = yield* Clock.currentTimeMillis;
			yield* Effect.logInfo("HTTP request").pipe(
				Effect.annotateLogs({ ...annotations, "http.duration": finished - started, "http.status": response.status }),
			);
			return response;
		});
}

export const routeRequestLogging = HttpRouter.middleware(
	Effect.map(
		SecureRandom,
		(random) => (effect) =>
			Effect.gen(function* () {
				const request = yield* HttpServerRequest.HttpServerRequest;
				const { route } = yield* HttpRouter.RouteContext;
				const started = yield* Clock.currentTimeMillis;
				const requestId = yield* random.uuidV4();
				return yield* effect.pipe(
					Effect.ensuring(
						HttpEffect.appendPreResponseHandler(responseLogger(started, { "http.method": request.method, "http.route": route.path, requestId })),
					),
				);
			}),
	),
);
