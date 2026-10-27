import { makeClient as makeRpcClient } from "@shivaedev/contract/bind.ts";
import { Api } from "./feature.ts";

export function connect(url: string) {
	const { api, Client } = makeRpcClient(Api, { url });
	return { api, runtime: Client.runtime };
}
