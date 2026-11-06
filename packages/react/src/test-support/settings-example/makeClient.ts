import { layerWebSocketConstructor } from "@effect/platform-node/NodeWS";
import { LiveConnection } from "@shivaedev/contract/automaticLive.ts";
import { makeClient as makeRpcClient } from "@shivaedev/contract/bind.ts";
import { SettingsContract } from "./contract.ts";

export function makeClient(url: string, token: string, entityId: number) {
	const { api, Client } = makeRpcClient(SettingsContract, {
		group: SettingsContract,
		headers: token === undefined ? {} : { authorization: `Bearer ${token}` },
		url,
		webSocketConstructor: layerWebSocketConstructor,
	});

	return {
		api,
		Client,
		entityId,
		query: api.get.query({ entityId }),
		...api[LiveConnection],
	};
}
