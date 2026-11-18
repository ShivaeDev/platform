import type { Effect, Schema } from "effect";
import type { Rpc, RpcClient } from "effect/rpc";
import type { RpcClientError } from "effect/rpc/RpcClientError";
import type { SyncToken } from "@shivaedev/changes/syncToken.ts";
import { LIVE_SYNC } from "#liveSyncRpc.ts";
import { commandSyncHeaders } from "#syncHeader.ts";

type Erased = Rpc.Rpc<string, Schema.Top, Schema.Top, Schema.Top>;

export function liveSyncRequest(client: RpcClient.RpcClient.Flat<Rpc.Any, RpcClientError>, token: SyncToken): Effect.Effect<void, unknown>;
export function liveSyncRequest(
	client: RpcClient.RpcClient.Flat<Rpc.Any, RpcClientError>,
	token: SyncToken,
): Effect.Effect<unknown, unknown, unknown> {
	const erased: RpcClient.RpcClient.Flat<Erased, RpcClientError> = client;
	return erased(LIVE_SYNC, undefined, { headers: commandSyncHeaders(token) });
}
