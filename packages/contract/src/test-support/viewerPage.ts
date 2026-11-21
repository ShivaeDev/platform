import { Effect, Layer } from "effect";
import * as AtomRegistry from "effect/reactivity/AtomRegistry";
import { layerMemoryProtocol } from "@shivaedev/test-kits/contract/testing.ts";
import { LiveConnection } from "#automaticLive.ts";
import { makeClient } from "#makeClient.ts";
import { storyRuntime } from "#test/storyRuntime.ts";
import { Notes, type viewerEngine } from "#test/viewerEngine.ts";

export type PageQuery = { readonly kind: "list"; readonly title: string } | { readonly kind: "listFor"; readonly userId: string };

export const viewerPage = Effect.fnUntraced(function* (engine: Effect.Success<typeof viewerEngine>, viewer: string, page: PageQuery) {
	const runtime = yield* storyRuntime;
	const registry = yield* Effect.acquireRelease(
		Effect.sync(() => AtomRegistry.make()),
		(current) => Effect.sync(() => current.dispose()),
	);
	const protocol = layerMemoryProtocol(Notes).pipe(Layer.provide(engine.layerFor(viewer)));
	const api = makeClient({ notes: Notes }, { protocol, registry, runtime }).api.notes;
	function queryOf() {
		switch (page.kind) {
			case "list":
				return api.list.query({ title: page.title });
			case "listFor":
				return api.listFor.query({ userId: page.userId });
		}
	}
	const query = queryOf();
	registry.mount(query);
	registry.mount(api[LiveConnection].connection);
	return { query, registry };
});

export type ViewerPage = Effect.Success<ReturnType<typeof viewerPage>>;
