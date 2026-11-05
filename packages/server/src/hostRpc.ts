import { Effect, Layer } from "effect";
import { type HttpEffect, HttpServerResponse } from "effect/http";
import { type Rpc, type RpcGroup, RpcMiddleware, RpcServer } from "effect/rpc";
import { CommandGuard, commandGuardLayer, guardCommands } from "@shivaedev/contract/CommandGuard.ts";
import { HostVersion } from "@shivaedev/contract/HostVersion.ts";
import { prependMiddleware } from "@shivaedev/contract/prependMiddleware.ts";
import { ReadPolicyGuard, readPolicyGuardLayer } from "@shivaedev/contract/ReadPolicyGuard.ts";
import { subjectLayers } from "@shivaedev/contract/subjectLayers.ts";
import { publishCommand } from "#publishCommand.ts";
import type { RequestServices } from "#requestServices.ts";
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
	const requests = yield* prependMiddleware(requested, ReadPolicyGuard.key);
	const guarded = yield* guardCommands(requests.merge(HostVersion.application));
	const traced = tracedGroup(guarded);
	const readPolicy = yield* ReadPolicyGuard.pipe(Effect.provide(readPolicyGuardLayer({ websocket })));
	const publication = yield* CommandGuard.pipe(Effect.provide(commandGuardLayer(publishCommand)));
	const handler = websocket ? RpcServer.toHttpEffectWebsocket(traced) : RpcServer.toHttpEffect(traced);
	return yield* handler.pipe(
		Effect.provideService(ReadPolicyGuard, readPolicy),
		Effect.provideService(CommandGuard, publication),
		Effect.provide(subjectLayers(group)),
		Effect.provide(Layer.succeed(requestsMiddleware, (effect) => Effect.provide(effect, requestLayer))),
	);
});
