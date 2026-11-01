import type { Effect } from "effect";
import type { HttpServerRequest, HttpServerResponse } from "effect/http";
import type { Identity, SessionUser } from "#identity.ts";
import type { SessionPolicy } from "#server/SessionPolicy.ts";

export type HostRouteGuard = <E, R>(
	handler: (request: HttpServerRequest.HttpServerRequest) => Effect.Effect<HttpServerResponse.HttpServerResponse, E, R>,
) => (
	request: HttpServerRequest.HttpServerRequest,
) => Effect.Effect<HttpServerResponse.HttpServerResponse, E, SessionPolicy | Exclude<R, Identity | SessionUser>>;
