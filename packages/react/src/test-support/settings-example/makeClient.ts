import { Effect, type Layer, Stream } from "effect";
import { HttpClient, HttpClientRequest } from "effect/http";
import { makeClient as makeRpcClient } from "@shivaedev/contract/bind.ts";
import { live } from "@shivaedev/contract/live.ts";
import { SettingsContract, SettingsRpc, settings } from "./contract.ts";

export function makeClient(url: string, token: string, entityId: number, httpClient: Layer.Layer<HttpClient.HttpClient>) {
	const { api, Client } = makeRpcClient(SettingsContract, {
		group: SettingsRpc,
		httpClient,
		transformClient: (client) => HttpClient.mapRequest(client, HttpClientRequest.setHeader("authorization", `Bearer ${token}`)),
		url,
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
