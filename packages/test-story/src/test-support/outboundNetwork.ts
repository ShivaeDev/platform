import { Effect } from "effect";
import { afterAll, beforeAll } from "vitest";
import { installOutbound } from "#internal/installOutbound.ts";
import { storyKit } from "#storyKit.ts";
import { outboundServers } from "./outbound.ts";

const servers = outboundServers();
let restoreNetwork: (() => void) | undefined;

// The previous dispatcher stands in for the network, so no story needs a live third party.
beforeAll(async () => {
	restoreNetwork = await installOutbound(servers.outbound);
});
afterAll(() => restoreNetwork?.());

function networkKit(passthrough: boolean) {
	return storyKit({
		clock: "live",
		create: () => ({}),
		name: passthrough ? "network enabled" : "contained Node",
		outbound: {},
		outboundPassthrough: passthrough,
		stages: [],
		verbs: (_engine, story) => ({
			requestProvider: () =>
				Effect.promise(async () => {
					story.tell("the application requests https://api.github.com/user");
					try {
						const response = await fetch("https://api.github.com/user");
						return await response.json();
					} catch {
						return "the application handled the fetch error";
					}
				}),
		}),
	});
}

export const containedNode = networkKit(false);
export const networkEnabled = networkKit(true);
export const composedNetwork = storyKit({ extends: [networkEnabled], name: "composed network" });
