import { layerWebSocketConstructor } from "@effect/platform-node/NodeWS";
import type { Layer } from "effect";
import type * as Atom from "effect/reactivity/Atom";
import type * as AtomRegistry from "effect/reactivity/AtomRegistry";
import type * as Socket from "effect/socket/Socket";
import { makeClient as makeRpcClient } from "@shivaedev/contract/bind.ts";
import { Notes } from "./notes.ts";

export function connect(
	url: string,
	registry: AtomRegistry.AtomRegistry,
	runtime: Atom.RuntimeFactory,
	token?: string,
	webSocketConstructor: Layer.Layer<Socket.WebSocketConstructor> = layerWebSocketConstructor,
) {
	const { api } = makeRpcClient(Notes, {
		...(token === undefined ? {} : { headers: { authorization: `Bearer ${token}` } }),
		registry,
		runtime,
		url,
		webSocketConstructor,
	});
	return api;
}
