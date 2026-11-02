import { Context, Effect } from "effect";
import { HttpRouter, type HttpServerError, type HttpServerRequest, type HttpServerResponse } from "effect/http";

export class AuthRouteHandler extends Context.Service<
	AuthRouteHandler,
	{
		readonly handle: Effect.Effect<HttpServerResponse.HttpServerResponse, HttpServerError.RequestError, HttpServerRequest.HttpServerRequest>;
	}
>()("@shivaedev/identity/AuthRouteHandler") {}

export const mountRoutes = HttpRouter.use((router) =>
	Effect.gen(function* () {
		const handler = yield* AuthRouteHandler;
		yield* router.add("*", "/api/auth/*", handler.handle);
	}),
);
