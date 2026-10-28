import { HttpClient, HttpClientRequest } from "effect/http";
import type * as AtomRegistry from "effect/reactivity/AtomRegistry";
import { makeClient as makeRpcClient } from "@shivaedev/contract/bind.ts";
import { Notes } from "./notes.ts";

export function connect(url: string, registry: AtomRegistry.AtomRegistry, token?: string) {
	const { api } = makeRpcClient(Notes, {
		registry,
		transformClient: (client) =>
			token === undefined ? client : HttpClient.mapRequest(client, HttpClientRequest.setHeader("authorization", `Bearer ${token}`)),
		url,
	});
	return api;
}
