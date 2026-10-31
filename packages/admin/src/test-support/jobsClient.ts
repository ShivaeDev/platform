import { Effect, type Layer } from "effect";
import * as AtomRegistry from "effect/reactivity/AtomRegistry";
import type * as Reactivity from "effect/reactivity/Reactivity";
import type { RpcClient } from "effect/rpc";
import { makeClient } from "@shivaedev/contract/bind.ts";
import { clientActivity } from "@shivaedev/contract/clientActivity.ts";
import type { pages } from "./jobsPages.ts";

type Registry = ReturnType<typeof pages>;
export const jobsClient = Effect.fnUntraced(function* (
	page: Registry["pages"][0],
	group: Registry["group"],
	protocol: Layer.Layer<RpcClient.Protocol>,
) {
	const transport = makeClient(page.contract, { group, live: false, protocol, url: "http://localhost/rpc" });
	const { api, Client } = transport;
	const registry = yield* Effect.acquireRelease(
		Effect.sync(() => AtomRegistry.make()),
		(value) => Effect.sync(() => value.dispose()),
	);
	function run<A, E>(effect: Effect.Effect<A, E, typeof Client.Identifier | Reactivity.Reactivity>) {
		return AtomRegistry.getResult(registry, Client.runtime.atom(effect));
	}
	return { activity: clientActivity(transport), api, registry, retryAction: Client.runtime.fn(api.retry.run), run };
});
