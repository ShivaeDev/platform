import { Effect } from "effect";
import { type HttpEffect, HttpServerResponse } from "effect/http";
import { type Rpc, type RpcGroup, RpcServer } from "effect/rpc";
import { guardReads, ReadPolicyGuard } from "@shivaedev/contract/ReadPolicyGuard.ts";
import type { RequestTracing } from "@shivaedev/identity/middleware.ts";
import { tracedGroup } from "#tracedGroup.ts";

export const rpcCacheControl: HttpEffect.PreResponseHandler = (_, response) =>
	Effect.succeed(HttpServerResponse.setHeader(response, "cache-control", "private, no-store"));

const makeHostRpc = Effect.fnUntraced(function* <R extends Rpc.Any>(group: RpcGroup.RpcGroup<R>, websocket = false) {
	const guarded = yield* guardReads(group);
	const traced = tracedGroup(guarded);
	const readPolicy = yield* ReadPolicyGuard.pipe(Effect.provide(ReadPolicyGuard.layer({ websocket })));
	const handler = websocket ? RpcServer.toHttpEffectWebsocket(traced) : RpcServer.toHttpEffect(traced);
	return yield* handler.pipe(Effect.provideService(ReadPolicyGuard, readPolicy));
});

export function hostRpc<R extends Rpc.Any>(
	group: RpcGroup.RpcGroup<R>,
	websocket?: boolean,
): Effect.Effect<
	Effect.Success<ReturnType<typeof RpcServer.toHttpEffect<R>>>,
	never,
	Exclude<Effect.Services<ReturnType<typeof RpcServer.toHttpEffect<R>>>, ReadPolicyGuard> | RequestTracing
>;
export function hostRpc<R extends Rpc.Any>(group: RpcGroup.RpcGroup<R>, websocket = false) {
	return makeHostRpc(group, websocket);
}
