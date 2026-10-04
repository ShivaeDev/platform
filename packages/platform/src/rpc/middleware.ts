import { Schema } from "effect";
import { RpcMiddleware } from "effect/unstable/rpc";
import { AuthUnavailable, Forbidden, Unauthorized } from "#errors/taxonomy.ts";
import type { Identity, OptionalIdentity, RequestId } from "./identity.ts";

export class RequestTracing extends RpcMiddleware.Service<RequestTracing, { provides: RequestId }>()("@shivaedev/platform/rpc/RequestTracing") {}

export class Authenticated extends RpcMiddleware.Service<Authenticated, { provides: Identity }>()("@shivaedev/platform/rpc/Authenticated", {
	error: Schema.Union([Unauthorized, AuthUnavailable, Forbidden]),
}) {}

export class MaybeAuthenticated extends RpcMiddleware.Service<MaybeAuthenticated, { provides: OptionalIdentity }>()(
	"@shivaedev/platform/rpc/MaybeAuthenticated",
	{ error: Schema.Union([AuthUnavailable, Forbidden]) },
) {}
