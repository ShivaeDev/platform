import { Schema } from "effect";
import { contract } from "#contract.ts";
import { LIVE_SYNC_COMMAND, LIVE_SYNC_CONTRACT } from "#liveSyncRpc.ts";
import { command } from "#operation.ts";

// A command that writes nothing: its sync token alone travels the change channel, behind every earlier commit.
export const LiveSync = contract(LIVE_SYNC_CONTRACT, {
	commands: [command(LIVE_SYNC_COMMAND, { invalidates: () => [], success: Schema.Void })],
});
