import { layerWebSocketConstructor } from "@effect/platform-node/NodeWS";
import { LiveConnection } from "@shivaedev/contract/automaticLive.ts";
import { makeClient as makeRpcClient } from "@shivaedev/contract/bind.ts";
import { Orders } from "./contract.ts";

export function makeClient(url: string, token?: string) {
	const { api, Client } = makeRpcClient(Orders, {
		group: Orders,
		headers: token === undefined ? {} : { authorization: `Bearer ${token}` },
		url,
		webSocketConstructor: layerWebSocketConstructor,
	});

	const query = api.get.query({ id: 1 });
	return { api, Client, query, ...api[LiveConnection] };
}
