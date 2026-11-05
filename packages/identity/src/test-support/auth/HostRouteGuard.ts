import type { Effect } from "effect";
import type { HttpServerRequest, HttpServerResponse } from "effect/http";
import type { Identity, SessionUser } from "#identity.ts";
import type { SessionPolicy } from "#server/SessionPolicy.ts";

export type HostRouteGuard = <E, R>(
	handler: Effect.Effect<HttpServerResponse.HttpServerResponse, E, R>,
) => Effect.Effect<
	HttpServerResponse.HttpServerResponse,
	E,
	HttpServerRequest.HttpServerRequest | SessionPolicy | Exclude<R, Identity | SessionUser>
>;
