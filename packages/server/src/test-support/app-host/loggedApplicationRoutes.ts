import { Deferred, Effect, Layer } from "effect";
import { HttpEffect, HttpMiddleware, HttpRouter, HttpServerResponse } from "effect/http";
import * as HttpStatus from "effect/http/HttpStatus";
import { host } from "#test/app-host/story.ts";

export const loggedApplicationRoutes = host.trait(
	"configured",
	"application routes have CORS, a response hook, a refusal, a defect and a held handler",
	function* (state) {
		const started = yield* Deferred.make<void>();
		const release = yield* Deferred.make<void>();
		state.requestLogging = { release, started };
		state.routes = Layer.mergeAll(
			HttpRouter.add(
				"*",
				"/items/:id",
				Effect.succeed(HttpServerResponse.text("private-response-body")).pipe(
					HttpEffect.withPreResponseHandler((_request, response) =>
						Effect.succeed(HttpServerResponse.setStatus(response, HttpStatus.fromLiteral("Created"))),
					),
				),
			).pipe(Layer.provide(HttpRouter.middleware(HttpMiddleware.cors({ allowedMethods: ["POST"], allowedOrigins: ["*"] })).layer)),
			HttpRouter.add("POST", "/refused/:id", HttpServerResponse.empty({ status: HttpStatus.fromLiteral("Forbidden") })),
			HttpRouter.add("POST", "/failed/:id", Effect.die("private-defect-body")),
			HttpRouter.add(
				"GET",
				"/slow",
				Deferred.succeed(started, undefined).pipe(Effect.andThen(Deferred.await(release)), Effect.as(HttpServerResponse.empty())),
			),
		);
	},
);
