import { layerWebSocketConstructorWS } from "@effect/platform-node/NodeSocket";
import type { Layer } from "effect";
import type * as AtomRegistry from "effect/reactivity/AtomRegistry";
import type * as Socket from "effect/socket/Socket";
import { makeClient as makeRpcClient } from "@shivaedev/contract/bind.ts";
import { Notes } from "./notes.ts";

export function connect(
	url: string,
	registry: AtomRegistry.AtomRegistry,
	token?: string,
	webSocketConstructor: Layer.Layer<Socket.WebSocketConstructor> = layerWebSocketConstructorWS,
) {
	const { api } = makeRpcClient(Notes, {
		...(token === undefined ? {} : { headers: { authorization: `Bearer ${token}` } }),
		registry,
		url,
		webSocketConstructor,
	});
	return api;
}
