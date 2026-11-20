import { Schema } from "effect";
import { Rpc, RpcGroup } from "effect/rpc";
import { CommandInvalidation } from "#serverMetadata.ts";

export const LIVE_SYNC_CONTRACT = "platform.liveSync";
export const LIVE_SYNC_COMMAND = "request";
const LIVE_SYNC_TAG = `${LIVE_SYNC_CONTRACT}.${LIVE_SYNC_COMMAND}` as const;
export const LIVE_SYNC: string = LIVE_SYNC_TAG;

// The browser's copy of the sync command: the host's declaration in LiveSync.ts is an operation file, which a browser bundle refuses.
export const liveSyncRpc = RpcGroup.make(Rpc.make(LIVE_SYNC_TAG, { success: Schema.Void }).annotate(CommandInvalidation, { invalidates: () => [] }));

export type LiveSyncRpc = RpcGroup.Rpcs<typeof liveSyncRpc>;
