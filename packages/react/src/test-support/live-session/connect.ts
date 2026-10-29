import { layerWebSocketConstructorWS } from "@effect/platform-node/NodeSocket";
import type * as AtomRegistry from "effect/reactivity/AtomRegistry";
import { makeClient as makeRpcClient } from "@shivaedev/contract/bind.ts";
import { Notes } from "./notes.ts";

export function connect(url: string, registry: AtomRegistry.AtomRegistry, token?: string) {
	const { api } = makeRpcClient(Notes, {
		headers: token === undefined ? {} : { authorization: `Bearer ${token}` },
		registry,
		url,
		webSocketConstructor: layerWebSocketConstructorWS,
	});
	return api;
}
