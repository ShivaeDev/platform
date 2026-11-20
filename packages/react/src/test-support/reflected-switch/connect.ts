import { layerWebSocketConstructor } from "@effect/platform-node/NodeWS";
import type * as Atom from "effect/reactivity/Atom";
import { makeClient } from "@shivaedev/contract/bind.ts";
import { clientActivity } from "@shivaedev/contract/clientActivity.ts";
import { ReflectedSwitch } from "#test/reflected-switch/ReflectedSwitch.ts";

export function connect(url: string, runtime: Atom.RuntimeFactory) {
	const client = makeClient(ReflectedSwitch, { runtime, url, webSocketConstructor: layerWebSocketConstructor });
	return { activity: clientActivity(client), command: client.api.set, query: client.api.get.query() };
}
export type SwitchClient = ReturnType<typeof connect>;
