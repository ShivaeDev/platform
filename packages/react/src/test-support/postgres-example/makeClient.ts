import { layerWebSocketConstructor } from "@effect/platform-node/NodeWS";
import { LiveConnection } from "@shivaedev/contract/automaticLive.ts";
import { makeClient as makeRpcClient } from "@shivaedev/contract/makeClient.ts";
import { Orders } from "#test/postgres-example/contract.ts";

export function makeClient(url: string, token?: string) {
	const {
		api: { orders: api },
		Client,
	} = makeRpcClient(
		{ orders: Orders },
		{
			headers: token === undefined ? {} : { authorization: `Bearer ${token}` },
			url,
			webSocketConstructor: layerWebSocketConstructor,
		},
	);

	const query = api.get.query({ id: 1 });
	return { api, Client, query, ...api[LiveConnection] };
}
