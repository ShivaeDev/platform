import { Effect, Schema } from "effect";
import { type HttpEffect, HttpServerResponse } from "effect/http";
import { type Rpc, type RpcGroup, RpcMiddleware, RpcServer } from "effect/rpc";
import { authorizeReads, CurrentViewer } from "@shivaedev/contract/readPolicy.ts";
import { MissingReadPolicy, QueryReadDenied } from "@shivaedev/contract/readPolicyErrors.ts";
import { tracedGroup } from "#tracedGroup.ts";

class HostedReadPolicy extends RpcMiddleware.Service<HostedReadPolicy>()("@shivaedev/server/HostedReadPolicy", {
	error: Schema.Union([MissingReadPolicy, QueryReadDenied]),
}) {}

export type { HostedReadPolicy };

export const rpcCacheControl: HttpEffect.PreResponseHandler = (_, response) =>
	Effect.succeed(HttpServerResponse.setHeader(response, "cache-control", "private, no-store"));

export const hostRpc = Effect.fnUntraced(function* <R extends Rpc.Any>(group: RpcGroup.RpcGroup<R>) {
	const guarded = group.middleware(HostedReadPolicy);
	// Keep the policy inside identity middleware so it sees the request's viewer.
	for (const rpc of guarded.requests.values()) {
		Object.assign(rpc, { middlewares: new Set([HostedReadPolicy, ...rpc.middlewares]) });
	}
	return yield* RpcServer.toHttpEffect(tracedGroup(guarded)).pipe(
		Effect.provideService(HostedReadPolicy, (effect, request) => Effect.flatMap(CurrentViewer, (viewer) => authorizeReads(effect, request, viewer))),
	);
});
