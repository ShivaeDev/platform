import { Effect } from "effect";
import * as AtomRegistry from "effect/reactivity/AtomRegistry";
import * as AtomRpc from "effect/reactivity/AtomRpc";
import { RpcTest } from "effect/rpc";
import { LiveConnection } from "#automaticLive.ts";
import { bind } from "#bind.ts";
import { Notes, type viewerEngine } from "./viewerEngine.ts";

export type PageQuery =
	| { readonly kind: "list"; readonly title: string }
	| { readonly kind: "listFor"; readonly userId: string }
	| { readonly kind: "unprotected" };

export const viewerPage = Effect.fnUntraced(function* (engine: Effect.Success<typeof viewerEngine>, viewer: string, page: PageQuery) {
	class Client extends AtomRpc.Service<Client>()(`test/ViewerPage/${viewer}`, {
		group: Notes,
		makeEffect: RpcTest.makeClient(Notes, { flatten: true }),
		protocol: engine.layerFor(viewer),
	}) {}
	const registry = yield* Effect.acquireRelease(
		Effect.sync(() => AtomRegistry.make()),
		(current) => Effect.sync(() => current.dispose()),
	);
	const api = bind(Notes, Client, { registry });
	function queryOf() {
		switch (page.kind) {
			case "list":
				return api.list.query({ title: page.title });
			case "listFor":
				return api.listFor.query({ userId: page.userId });
			case "unprotected":
				return api.unprotected.query(undefined);
		}
	}
	const query = queryOf();
	registry.mount(query);
	registry.set(api[LiveConnection].coalesceWindow, 0);
	registry.mount(api[LiveConnection].connection);
	return { query, registry };
});

export type ViewerPage = Effect.Success<ReturnType<typeof viewerPage>>;
