import type { Rpc, RpcClient } from "effect/rpc";
import type { RpcClientError } from "effect/rpc/RpcClientError";
import type { SyncToken } from "@shivaedev/changes/syncToken.ts";
import { LIVE_SYNC, type LiveSyncRpc } from "#liveSyncRpc.ts";
import { commandSyncHeaders } from "#syncHeader.ts";

export function liveSyncRequest(client: RpcClient.RpcClient.Flat<Rpc.Any | LiveSyncRpc, RpcClientError>, token: SyncToken) {
	return client(LIVE_SYNC, undefined, { headers: commandSyncHeaders(token) });
}
