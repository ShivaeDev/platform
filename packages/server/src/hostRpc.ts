import { Effect } from "effect";
import { type HttpEffect, HttpServerResponse } from "effect/http";
import { type Rpc, type RpcGroup, RpcServer } from "effect/rpc";
import { readPolicyGroup } from "#hostReadPolicy.ts";
import { tracedGroup } from "#tracedGroup.ts";

export const rpcCacheControl: HttpEffect.PreResponseHandler = (_, response) =>
	Effect.succeed(HttpServerResponse.setHeader(response, "cache-control", "private, no-store"));

export const hostRpc = Effect.fnUntraced(function* <R extends Rpc.Any>(group: RpcGroup.RpcGroup<R>, authorize: boolean) {
	return authorize ? yield* RpcServer.toHttpEffect(tracedGroup(readPolicyGroup(group))) : yield* RpcServer.toHttpEffect(tracedGroup(group));
});
