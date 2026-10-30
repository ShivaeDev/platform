import { Effect } from "effect";
import { afterAll, beforeAll } from "vitest";
import { installOutbound } from "#internal/installOutbound.ts";
import { storyKit } from "#storyKit.ts";
import { outbound } from "./outbound.ts";

let restoreNetwork: (() => void) | undefined;

// The previous dispatcher stands in for the network, so no story needs a live third party.
beforeAll(async () => {
	restoreNetwork = await installOutbound(outbound);
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
			requestsProvider: () =>
				Effect.promise(async () => {
					story.tell("the application requests GET https://api.github.com/user");
					try {
						const response = await fetch("https://api.github.com/user");
						const { method, name, path }: { readonly method: string; readonly name: string; readonly path: string } = await response.json();
						return `the ${name} server answered ${method} ${path}`;
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
