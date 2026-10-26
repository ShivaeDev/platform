import { Effect, type Layer } from "effect";
import * as AtomRegistry from "effect/reactivity/AtomRegistry";
import * as AtomRpc from "effect/reactivity/AtomRpc";
import type * as Reactivity from "effect/reactivity/Reactivity";
import type { RpcClient } from "effect/rpc";
import { bind } from "@shivaedev/contract/bind.ts";
import type { pages } from "./jobsPages.ts";

type Registry = ReturnType<typeof pages>;
export const jobsClient = Effect.fnUntraced(function* (
	page: Registry["pages"][0],
	group: Registry["group"],
	protocol: Layer.Layer<RpcClient.Protocol>,
) {
	class Client extends AtomRpc.Service<Client>()("test/AdminJobsClient", { group, protocol }) {}
	const api = bind(page.contract, Client);
	const registry = yield* Effect.acquireRelease(
		Effect.sync(() => AtomRegistry.make()),
		(value) => Effect.sync(() => value.dispose()),
	);
	function run<A, E>(effect: Effect.Effect<A, E, Client | Reactivity.Reactivity>) {
		return AtomRegistry.getResult(registry, Client.runtime.atom(effect));
	}
	return { api, registry, run };
});
