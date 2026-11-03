import { Effect } from "effect";
import { type HttpEffect, HttpServerResponse } from "effect/http";
import { type Rpc, type RpcGroup, RpcServer } from "effect/rpc";
import { CommandGuard, commandGuardLayer, guardCommands } from "@shivaedev/contract/CommandGuard.ts";
import { ReadPolicyGuard, readPolicyGuardLayer } from "@shivaedev/contract/ReadPolicyGuard.ts";
import { publishCommand } from "#publishCommand.ts";
import { tracedGroup } from "#tracedGroup.ts";

export const rpcCacheControl: HttpEffect.PreResponseHandler = (_, response) =>
	Effect.succeed(HttpServerResponse.setHeader(response, "cache-control", "private, no-store"));

export const hostRpc = Effect.fnUntraced(function* <R extends Rpc.Any>(group: RpcGroup.RpcGroup<R>, websocket = false) {
	const guarded = yield* guardCommands(group);
	const traced = tracedGroup(guarded);
	const readPolicy = yield* ReadPolicyGuard.pipe(Effect.provide(readPolicyGuardLayer({ websocket })));
	const publication = yield* CommandGuard.pipe(Effect.provide(commandGuardLayer(publishCommand)));
	const handler = websocket ? RpcServer.toHttpEffectWebsocket(traced) : RpcServer.toHttpEffect(traced);
	return yield* handler.pipe(Effect.provideService(ReadPolicyGuard, readPolicy), Effect.provideService(CommandGuard, publication));
});
