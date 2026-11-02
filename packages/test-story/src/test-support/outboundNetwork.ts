import { Effect } from "effect";
import { afterAll, beforeAll } from "vitest";
import { routeOutbound } from "#routeOutbound.ts";
import { storyKit } from "#storyKit.ts";
import { outbound } from "./outbound.ts";

let restoreNetwork: (() => void) | undefined;

// The previous dispatcher stands in for the network, so no story needs a live third party.
beforeAll(async () => {
	await fetch("data:,");
	const slots = ["undici.globalDispatcher.1", "undici.globalDispatcher.2"].flatMap((name) => {
		const key = Symbol.for(name);
		const previous: unknown = Reflect.get(globalThis, key);
		if (typeof previous !== "object" || previous === null || !("dispatch" in previous) || typeof previous.dispatch !== "function") {
			return [];
		}
		const dispatch = previous.dispatch.bind(previous);
		Object.defineProperty(globalThis, key, {
			value: {
				dispatch(options: { readonly origin: string | URL }, handler: unknown) {
					return dispatch({ ...options, origin: outbound["api.github.com"] }, handler);
				},
			},
		});
		return [{ key, previous }];
	});
	restoreNetwork = () => {
		for (const { key, previous } of slots) {
			Object.defineProperty(globalThis, key, { value: previous });
		}
	};
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
			allowsPassthrough: () => {
				story.tell("another registration allows network passthrough");
				return routeOutbound({}, { passthrough: true });
			},
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
