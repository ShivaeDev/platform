import { layerWebSocketConstructorWS } from "@effect/platform-node/NodeSocket";
import type * as AtomRegistry from "effect/reactivity/AtomRegistry";
import { makeClient } from "@shivaedev/contract/bind.ts";
import { Accounts } from "./feature.ts";

export function connect(url: string, registry: AtomRegistry.AtomRegistry) {
	return makeClient(Accounts, { registry, url, webSocketConstructor: layerWebSocketConstructorWS }).api;
}
