import { Schema } from "effect";
import { contract } from "#contract.ts";
import { command } from "#operation.ts";

// A command that writes nothing: its sync token alone travels the change channel, behind every earlier commit.
export const LiveSync = contract("platform.liveSync", {
	commands: [command("request", { invalidates: () => [], success: Schema.Void })],
});

export const LIVE_SYNC: string = "platform.liveSync.request";
