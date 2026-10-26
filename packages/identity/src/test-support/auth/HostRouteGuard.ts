import type { Effect } from "effect";
import type { HttpServerRequest, HttpServerResponse } from "effect/http";

export type HostRouteGuard = <E, R>(
	handler: (request: HttpServerRequest.HttpServerRequest) => Effect.Effect<HttpServerResponse.HttpServerResponse, E, R>,
) => (request: HttpServerRequest.HttpServerRequest) => Effect.Effect<HttpServerResponse.HttpServerResponse, E, R>;
