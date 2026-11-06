import { Effect, Layer, Schema } from "effect";
import type * as AtomRegistry from "effect/reactivity/AtomRegistry";
import * as AtomRpc from "effect/reactivity/AtomRpc";
import { RpcTest } from "effect/rpc";
import { bind } from "@shivaedev/contract/bind.ts";
import { contract } from "@shivaedev/contract/contract.ts";
import { query } from "@shivaedev/contract/operation.ts";
import { hostChanges } from "@shivaedev/server/hostChanges.ts";

const Api = contract("module", {
	keyScope: "session",
	queries: [query("read", { readPolicy: () => Effect.succeed(true), reads: () => [], success: Schema.String })],
});

export function composedModule(name: string, registry: AtomRegistry.AtomRegistry) {
	const application = Api.application.toLayer({ "module.read": () => Effect.succeed(name) });
	class Client extends AtomRpc.Service<Client>()(`test/Composed/${name}`, {
		group: Api,
		makeEffect: RpcTest.makeClient(Api, { flatten: true }),
		protocol: Layer.merge(application, hostChanges(Api).pipe(Layer.provide(application))),
	}) {}
	return { api: bind(Api, Client, { registry }), name };
}
