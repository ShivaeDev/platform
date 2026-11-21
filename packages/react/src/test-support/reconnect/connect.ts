import { layerWebSocketConstructor } from "@effect/platform-node/NodeWS";
import type * as Atom from "effect/reactivity/Atom";
import type * as AtomRegistry from "effect/reactivity/AtomRegistry";
import { makeClient } from "@shivaedev/contract/makeClient.ts";
import { Accounts } from "#test/reconnect/feature.ts";

export function connect(url: string, registry: AtomRegistry.AtomRegistry, runtime: Atom.RuntimeFactory) {
	return makeClient({ accounts: Accounts }, { registry, runtime, url, webSocketConstructor: layerWebSocketConstructor }).api.accounts;
}
