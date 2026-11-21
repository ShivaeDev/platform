import { Effect, Layer } from "effect";
import type { Rpc, RpcGroup } from "effect/rpc";
import { commandGuardLayer, guardCommands } from "@shivaedev/contract/CommandGuard.ts";
import { HostVersion } from "@shivaedev/contract/HostVersion.ts";
import { LiveSync } from "@shivaedev/contract/LiveSync.ts";
import { prependMiddleware } from "@shivaedev/contract/prependMiddleware.ts";
import { ReadPolicyGuard, readPolicyGuardLayer } from "@shivaedev/contract/ReadPolicyGuard.ts";
import { publishCommand } from "#publishCommand.ts";

export const servedGroup = Effect.fnUntraced(function* <R extends Rpc.Any>(group: RpcGroup.RpcGroup<R>, websocket: boolean) {
	const reads = yield* prependMiddleware(group, ReadPolicyGuard.key);
	return {
		group: yield* guardCommands(reads.merge(HostVersion.application).merge(LiveSync.application)),
		guards: Layer.merge(readPolicyGuardLayer({ websocket }), commandGuardLayer(publishCommand)),
	};
});
