import { Effect } from "effect";
import * as AtomRegistry from "effect/reactivity/AtomRegistry";
import * as AtomRpc from "effect/reactivity/AtomRpc";
import { RpcTest } from "effect/rpc";
import { LiveConnection } from "#automaticLive.ts";
import { bind } from "#bind.ts";
import { storyRuntime } from "#test/storyRuntime.ts";
import { Notes, type viewerEngine } from "#test/viewerEngine.ts";

export type PageQuery = { readonly kind: "titled"; readonly title: string } | { readonly kind: "list"; readonly owner: string };

export const viewerPage = Effect.fnUntraced(function* (engine: Effect.Success<typeof viewerEngine>, viewer: string, page: PageQuery) {
	const runtime = yield* storyRuntime;
	class Client extends AtomRpc.Service<Client>()(`test/ViewerPage/${viewer}`, {
		group: Notes,
		makeEffect: RpcTest.makeClient(Notes, { flatten: true }),
		protocol: engine.layerFor(viewer),
		runtime,
	}) {}
	const registry = yield* Effect.acquireRelease(
		Effect.sync(() => AtomRegistry.make()),
		(current) => Effect.sync(() => current.dispose()),
	);
	const api = bind(Notes, Client, { registry });
	function queryOf() {
		switch (page.kind) {
			case "titled":
				return api.titled.query({ title: page.title });
			case "list":
				return api.list.query({ owner: page.owner });
		}
	}
	const query = queryOf();
	registry.mount(query);
	registry.mount(api[LiveConnection].connection);
	return { query, registry };
});

export type ViewerPage = Effect.Success<ReturnType<typeof viewerPage>>;
