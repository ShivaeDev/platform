import { layerWebSocketConstructorWS } from "@effect/platform-node/NodeSocket";
import { Effect, Stream } from "effect";
import { makeClient as makeRpcClient } from "@shivaedev/contract/bind.ts";
import { live } from "@shivaedev/contract/live.ts";
import { SettingsContract, SettingsRpc, settings } from "./contract.ts";

export function makeClient(url: string, token: string, entityId: number) {
	const { api, Client } = makeRpcClient(SettingsContract, {
		group: SettingsRpc,
		headers: token === undefined ? {} : { authorization: `Bearer ${token}` },
		url,
		webSocketConstructor: layerWebSocketConstructorWS,
	});
	const subscription = live(Client.runtime, {
		resyncKeys: [settings.item(entityId)],
		stream: Stream.unwrap(Client.use((client) => Effect.succeed(client("subscribe", { entityId })))),
	});
	return {
		api,
		Client,
		entityId,
		query: api.get.query({ entityId }),
		...subscription,
	};
}
