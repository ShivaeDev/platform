import { Effect, Layer, Option, Stream, SubscriptionRef } from "effect";
import * as Reactivity from "effect/reactivity/Reactivity";
import { RpcClient } from "effect/rpc";
import { rerunQuery } from "@shivaedev/server/rerunQuery.ts";
import { layerMemoryProtocol } from "@shivaedev/test-kits/contract/testing.ts";
import { changesHandlerLayer } from "#changesHandlerLayer.ts";
import { makeLiveServer } from "#makeLiveServer.ts";
import { querySubscription } from "#querySubscription.ts";
import type { QueryUpdate } from "#queryUpdate.ts";
import { CurrentViewer } from "#readPolicy.ts";
import { type Handlers, handlers, Libraries, Library, LibraryViewer, makeBooks, makeReaders } from "#test/repository-reads/fixture.ts";

const views = {
	"alice's reader row": { payload: undefined, query: "reader" },
	"book 1": { payload: { id: 1 }, query: "book" },
	"book 1 read 100 times": { payload: { id: 1, times: 100 }, query: "rereadBook" },
	"shelf 1": { payload: { shelf: 1 }, query: "shelf" },
	"shelf 1 behind a policy that reads and records alice's reader row": { payload: { shelf: 1 }, query: "readerShelf" },
	"shelf 1 declaring its bucket and filtering every book in code": { payload: { shelf: 1 }, query: "declaredShelf" },
	"the catalog": { payload: undefined, query: "catalog" },
} as const;
export type View = keyof typeof views;

export interface Watched {
	readonly updates: SubscriptionRef.SubscriptionRef<readonly QueryUpdate[]>;
	readonly views: readonly View[];
}

export const engine = Effect.gen(function* () {
	const shared = yield* Reactivity.Reactivity;
	const registrations: (readonly string[])[] = [];
	const reactivity = Reactivity.Reactivity.of({
		...shared,
		registerUnsafe: (keys, handler) => {
			registrations.push(Array.isArray(keys) ? keys.map(String) : Object.keys(keys));
			return shared.registerUnsafe(keys, handler);
		},
	});
	const live = yield* makeLiveServer.pipe(Effect.provideService(Reactivity.Reactivity, reactivity));
	const library = yield* Effect.all({ books: makeBooks, readers: makeReaders }).pipe(Effect.provideService(Reactivity.Reactivity, reactivity));
	const services = Layer.merge(Layer.succeed(Library, library), Layer.succeed(Reactivity.Reactivity, reactivity));
	const viewer = Option.some({ id: "alice" });
	const connect = Effect.fnUntraced(function* (style: Handlers) {
		const application = handlers[style].pipe(Layer.provide(services));
		const changes = changesHandlerLayer(
			Libraries,
			() =>
				({ queries }, options) =>
					Stream.unwrap(
						Effect.map(querySubscription(options.rpc, queries, viewer), (subscription) =>
							live.subscribe(subscription, rerunQuery(Libraries.application, options)),
						),
					),
		).pipe(Layer.provide(application), Layer.provide(services));
		const protocol = layerMemoryProtocol(Libraries).pipe(
			Layer.provide([application, changes, Layer.succeed(LibraryViewer, (effect) => Effect.provideService(effect, CurrentViewer, viewer))]),
		);
		return yield* RpcClient.make(Libraries, { flatten: true }).pipe(Effect.provideContext(yield* Layer.build(protocol)));
	});
	const clients = { "hand-written handlers": yield* connect("hand-written handlers"), "module handlers": yield* connect("module handlers") };
	const client = clients["module handlers"];
	const watched: { current: Watched | undefined } = { current: undefined };
	const watch = Effect.fnUntraced(function* (watching: readonly View[], style: Handlers) {
		const updates = yield* SubscriptionRef.make<readonly QueryUpdate[]>([]);
		yield* clients[style]("library.$changes", { queries: watching.map((view) => views[view]) }).pipe(
			Stream.runForEach((update) => SubscriptionRef.update(updates, (all) => [...all, update])),
			Effect.forkScoped,
		);
		watched.current = { updates, views: watching };
		return updates;
	});
	return { client, registrations, watch, watched };
});
