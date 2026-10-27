import { Effect, Stream } from "effect";
import * as AsyncResult from "effect/reactivity/AsyncResult";
import * as AtomRegistry from "effect/reactivity/AtomRegistry";
import * as AtomRpc from "effect/reactivity/AtomRpc";
import { RpcTest } from "effect/rpc";
import { readKeys } from "#keys.ts";
import { live } from "#live.ts";
import { Notes, notes, type viewerEngine } from "./viewerEngine.ts";

export const viewerPage = Effect.fnUntraced(function* (engine: Effect.Success<typeof viewerEngine>, viewer: string, id: number) {
	class Client extends AtomRpc.Service<Client>()("test/ViewerPage", {
		group: Notes,
		makeEffect: RpcTest.makeClient(Notes, { flatten: true }),
		protocol: engine.layer,
	}) {}
	const registry = yield* Effect.acquireRelease(
		Effect.sync(() => AtomRegistry.make()),
		(current) => Effect.sync(() => current.dispose()),
	);
	const query = Client.query("notes.get", { id }, { headers: { viewer }, reactivityKeys: readKeys([notes.item(id)]) });
	const subscription = live(Client.runtime, {
		coalesceWindow: 0,
		resyncKeys: [notes.item(id)],
		stream: Stream.unwrap(
			Client.use((client) => Effect.succeed(client("notes.$changes", { queries: [{ payload: { id }, query: "get" }] }, { headers: { viewer } }))),
		),
	});
	registry.mount(query);
	registry.mount(subscription.connection);
	return {
		status: () => registry.get(subscription.status),
		title: () => AsyncResult.getOrElse(registry.get(query), () => undefined)?.title,
	};
});
