import { Effect, Schema, Stream } from "effect";
import type * as AtomRegistry from "effect/reactivity/AtomRegistry";
import * as AtomRpc from "effect/reactivity/AtomRpc";
import { RpcTest } from "effect/rpc";
import { bind } from "@shivaedev/contract/bind.ts";
import { contract } from "@shivaedev/contract/contract.ts";
import { query } from "@shivaedev/contract/operation.ts";

const Api = contract("module", {
	keyScope: "session",
	queries: [query("read", { readPolicy: () => Effect.succeed(true), reads: () => [], success: Schema.String })],
});

export function composedModule(name: string, registry: AtomRegistry.AtomRegistry) {
	class Client extends AtomRpc.Service<Client>()(`test/Composed/${name}`, {
		group: Api,
		makeEffect: RpcTest.makeClient(Api, { flatten: true }),
		protocol: Api.toLayer({
			"module.$changes": () => Stream.concat(Stream.succeed({ _tag: "Resync" } as const), Stream.never),
			"module.read": () => Effect.succeed(name),
		}),
	}) {}
	return { api: bind(Api, Client, { registry }), name };
}
