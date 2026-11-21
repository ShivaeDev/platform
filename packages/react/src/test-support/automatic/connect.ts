import type { Layer } from "effect";
import type * as Atom from "effect/reactivity/Atom";
import type * as Socket from "effect/socket/Socket";
import { makeClient as makeRpcClient } from "@shivaedev/contract/makeClient.ts";
import { Api, Preview } from "#test/automatic/feature.ts";

export function connect(url: string, webSocketConstructor: Layer.Layer<Socket.WebSocketConstructor> | undefined, runtime: Atom.RuntimeFactory) {
	const options = webSocketConstructor === undefined ? { runtime, url } : { runtime, url, webSocketConstructor };
	const {
		api: { api, preview },
		Client,
	} = makeRpcClient({ api: Api, preview: Preview }, options);
	return { api, preview, runtime: Client.runtime };
}
