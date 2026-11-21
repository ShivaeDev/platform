import { layerWebSocketConstructor } from "@effect/platform-node/NodeWS";
import type * as Atom from "effect/reactivity/Atom";
import { clientActivity } from "@shivaedev/contract/clientActivity.ts";
import { makeClient } from "@shivaedev/contract/makeClient.ts";
import { ReflectedSwitch } from "#test/reflected-switch/ReflectedSwitch.ts";

export function connect(url: string, runtime: Atom.RuntimeFactory) {
	const client = makeClient({ reflectedSwitch: ReflectedSwitch }, { runtime, url, webSocketConstructor: layerWebSocketConstructor });
	return { activity: clientActivity(client), command: client.api.reflectedSwitch.set, query: client.api.reflectedSwitch.get.query() };
}
export type SwitchClient = ReturnType<typeof connect>;
