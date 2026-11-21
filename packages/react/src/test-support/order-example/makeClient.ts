import { layerWebSocketConstructor } from "@effect/platform-node/NodeWS";
import { makeClient as makeRpcClient } from "@shivaedev/contract/makeClient.ts";
import { Orders } from "#test/order-example/contract.ts";

export function makeClient({ url, token }: { readonly url: string; readonly token?: string | undefined }) {
	const connection = makeRpcClient(
		{ orders: Orders },
		{
			headers: token === undefined ? {} : { cookie: `order-session=${token}` },
			url,
			webSocketConstructor: layerWebSocketConstructor,
		},
	);
	const renameOrder = connection.Client.runtime.fn(connection.api.orders.save.run);

	return { api: connection.api.orders, Client: connection.Client, client: connection.client, connection, renameOrder };
}
