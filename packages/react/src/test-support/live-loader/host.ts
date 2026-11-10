import { Deferred, Effect, Layer, Queue, Schema, Stream } from "effect";
import { makeClient } from "@shivaedev/contract/bind.ts";
import { changesHandlerLayer } from "@shivaedev/contract/changesHandlerLayer.ts";
import { compareQueries } from "@shivaedev/contract/compareQueries.ts";
import { contract } from "@shivaedev/contract/contract.ts";
import { query } from "@shivaedev/contract/operation.ts";
import { querySubscription } from "@shivaedev/contract/querySubscription.ts";
import { CurrentViewer } from "@shivaedev/contract/readPolicy.ts";
import { rerunQuery } from "@shivaedev/server/rerunQuery.ts";
import { layerMemoryProtocol } from "@shivaedev/test-kits/contract/testing.ts";
import { storyRuntime } from "#test/storyRuntime.ts";

const Notes = contract("liveLoaderNotes", {
	queries: [query("get", { readPolicy: () => Effect.succeed(true), reads: () => [], success: Schema.Struct({ title: Schema.String }) })],
});

export const liveLoaderHost = Effect.fnUntraced(function* () {
	const calls: string[] = [];
	const subscriptions: { open: boolean }[] = [];
	const closed = yield* Queue.unbounded<void>();
	const started = yield* Deferred.make<void>();
	let response = Promise.withResolvers<{ readonly title: string }>();
	const application = Notes.application.toLayer({
		"liveLoaderNotes.get": () =>
			Effect.suspend(() => {
				calls.push("get");
				return Deferred.succeed(started, undefined).pipe(Effect.andThen(Effect.promise(() => response.promise)));
			}),
	});
	const opened = Effect.acquireRelease(
		Effect.sync(() => {
			const subscription = { open: true };
			subscriptions.push(subscription);
			return subscription;
		}),
		(subscription) =>
			Effect.sync(() => {
				subscription.open = false;
			}).pipe(Effect.andThen(Queue.offer(closed, undefined))),
	);
	const changes = changesHandlerLayer(
		Notes,
		() =>
			({ queries }, options) =>
				Stream.unwrap(
					Effect.gen(function* () {
						yield* opened;
						const requested = yield* querySubscription(options.rpc, queries, yield* CurrentViewer);
						const first = yield* compareQueries(requested, rerunQuery(Notes.application, options))({ _tag: "Resync" });
						return Stream.concat(Stream.fromIterable(first), Stream.never);
					}),
				),
	);
	const transport = yield* Layer.build(
		layerMemoryProtocol(Notes).pipe(Layer.provide(Layer.merge(application, changes.pipe(Layer.provide(application))))),
	);
	const client = makeClient(Notes, { protocol: Layer.succeedContext(transport), runtime: yield* storyRuntime, url: "memory://live-loader-notes" });
	return {
		atom: client.api.get.query(),
		calls,
		closed: Queue.take(closed),
		next: () => {
			response = Promise.withResolvers();
		},
		respond: (title: string) => response.resolve({ title }),
		started: Deferred.await(started),
		subscriptions: () => subscriptions.map((subscription) => (subscription.open ? "open" : "closed")),
	};
});
