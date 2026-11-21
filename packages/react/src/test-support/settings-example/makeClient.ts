import { layerWebSocketConstructor } from "@effect/platform-node/NodeWS";
import { LiveConnection } from "@shivaedev/contract/automaticLive.ts";
import { makeClient as makeRpcClient } from "@shivaedev/contract/makeClient.ts";
import { SettingsContract } from "#test/settings-example/contract.ts";

export function makeClient(url: string, token: string, entityId: number) {
	const {
		api: { settingsContract: api },
		Client,
	} = makeRpcClient(
		{ settingsContract: SettingsContract },
		{
			headers: token === undefined ? {} : { authorization: `Bearer ${token}` },
			url,
			webSocketConstructor: layerWebSocketConstructor,
		},
	);

	return {
		api,
		Client,
		entityId,
		query: api.get.query({ entityId }),
		...api[LiveConnection],
	};
}
