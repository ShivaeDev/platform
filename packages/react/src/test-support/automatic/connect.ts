import type { Layer } from "effect";
import type * as Socket from "effect/socket/Socket";
import { makeClient as makeRpcClient } from "@shivaedev/contract/bind.ts";
import { Api, Preview } from "./feature.ts";

export function connect(url: string, webSocketConstructor?: Layer.Layer<Socket.WebSocketConstructor>) {
	const options = webSocketConstructor === undefined ? { url } : { url, webSocketConstructor };
	const { api, Client } = makeRpcClient(Api, options);
	const { api: preview } = makeRpcClient(Preview, options);
	return { api, preview, runtime: Client.runtime };
}
