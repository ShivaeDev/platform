import { Effect, Schema } from "effect";
import type * as AtomRegistry from "effect/reactivity/AtomRegistry";
import { contract } from "@shivaedev/contract/contract.ts";
import { makeClient } from "@shivaedev/contract/makeClient.ts";
import { query } from "@shivaedev/contract/operation.ts";
import { layerLiveMemoryProtocol } from "@shivaedev/test-kits/contract/liveMemoryProtocol.ts";

const Api = contract("module", {
	keyScope: "session",
	queries: [query("read", { readPolicy: () => Effect.succeed(true), reads: () => [], success: Schema.String })],
});

export function composedModule(name: string, registry: AtomRegistry.AtomRegistry) {
	const application = Api.application.toLayer({ "module.read": () => Effect.succeed(name) });
	const connection = makeClient({ module: Api }, { protocol: layerLiveMemoryProtocol(Api, application), registry });
	return { api: connection.api.module, name };
}
