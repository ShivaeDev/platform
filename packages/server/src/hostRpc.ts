import { Effect, Layer } from "effect";
import { type HttpEffect, HttpServerResponse } from "effect/http";
import { type Rpc, type RpcGroup, RpcMiddleware, RpcServer } from "effect/rpc";
import { prependMiddleware } from "@shivaedev/contract/prependMiddleware.ts";
import { subjectLayers } from "@shivaedev/contract/subjectLayers.ts";
import { type RequestServices, RequestServicesLayer } from "#requestServices.ts";
import { servedGroup } from "#servedGroup.ts";
import { tracedGroup } from "#tracedGroup.ts";

export const rpcCacheControl: HttpEffect.PreResponseHandler = (_, response) =>
	Effect.succeed(HttpServerResponse.setHeader(response, "cache-control", "private, no-store"));

export const hostRpc = Effect.fnUntraced(function* <R extends Rpc.Any, TServices = never, TRequirements = never>(
	group: RpcGroup.RpcGroup<R>,
	websocket = false,
	services?: Layer.Layer<TServices, never, TRequirements>,
) {
	const requestsMiddleware = RpcMiddleware.Service<RequestServices<TServices, TRequirements>, { provides: TServices; requires: TRequirements }>()(
		"@shivaedev/server/RequestServices",
	);
	const requestLayer = Layer.mergeAll(services ?? Layer.empty);
	const requested = yield* prependMiddleware(group.middleware(requestsMiddleware), requestsMiddleware.key);
	const served = yield* servedGroup(requested, websocket);
	const traced = tracedGroup(served.group);
	const handler = websocket ? RpcServer.toHttpEffectWebsocket(traced) : RpcServer.toHttpEffect(traced);
	return yield* handler.pipe(
		Effect.provide(served.guards),
		Effect.provide(subjectLayers(group)),
		Effect.provide(
			Layer.succeed(requestsMiddleware, (effect) =>
				effect.pipe(Effect.provideService(RequestServicesLayer, { requestLayer }), Effect.provide(requestLayer)),
			),
		),
	);
});
