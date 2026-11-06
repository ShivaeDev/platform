import { Deferred, Effect, Layer, Schema, Stream } from "effect";
import * as AtomRpc from "effect/reactivity/AtomRpc";
import { RpcTest } from "effect/rpc";
import { collection } from "@shivaedev/changes/keys.ts";
import { bind } from "@shivaedev/contract/bind.ts";
import { changesHandlerLayer } from "@shivaedev/contract/changesHandlerLayer.ts";
import { compareQueries } from "@shivaedev/contract/compareQueries.ts";
import { contract } from "@shivaedev/contract/contract.ts";
import { query } from "@shivaedev/contract/operation.ts";
import { querySubscription } from "@shivaedev/contract/querySubscription.ts";
import { CurrentViewer } from "@shivaedev/contract/readPolicy.ts";
import type { ResumeSource } from "@shivaedev/contract/resume.ts";
import { rerunQuery } from "@shivaedev/server/rerunQuery.ts";

const notes = collection("resumeNotes", Schema.Number);
const Notes = contract("resumeNotes", {
	queries: [
		query("get", {
			payload: { id: Schema.Number },
			readPolicy: () => Effect.succeed(true),
			reads: ({ id }) => [notes.item(id)],
			success: Schema.String,
		}),
	],
});

export function resumeLiveClient(resume?: ResumeSource) {
	const titles = new Map([
		[1, "One"],
		[2, "Two"],
	]);
	const subscriptions: { active: boolean }[] = [];
	let ended = Effect.runSync(Deferred.make<void>());
	const application = Notes.application.toLayer({ "resumeNotes.get": ({ id }) => Effect.sync(() => titles.get(id) ?? "Missing") });
	const changes = changesHandlerLayer(
		Notes,
		() =>
			({ queries }, options) =>
				Stream.unwrap(
					Effect.gen(function* () {
						const subscription = { active: true };
						subscriptions.push(subscription);
						function close() {
							subscription.active = false;
						}
						yield* Effect.addFinalizer(() => Effect.sync(close));
						const requested = yield* querySubscription(options.rpc, queries, yield* CurrentViewer);
						const updates = yield* compareQueries(requested, rerunQuery(Notes.application, options))({ _tag: "Resync" });
						return Stream.concat(Stream.fromIterable(updates), Stream.drain(Stream.fromEffect(Deferred.await(ended))));
					}),
				),
	);
	const handlers = Layer.merge(application, changes.pipe(Layer.provide(application)));
	class Client extends AtomRpc.Service<Client>()("test/ResumeNotes", {
		group: Notes,
		makeEffect: RpcTest.makeClient(Notes, { flatten: true }),
		protocol: handlers,
	}) {}
	return {
		active: () => subscriptions.filter((subscription) => subscription.active).length,
		api: bind(Notes, Client, resume === undefined ? {} : { resume }),
		disconnect: () => {
			const previous = ended;
			ended = Effect.runSync(Deferred.make<void>());
			return Effect.runPromise(Deferred.succeed(previous, undefined));
		},
		rename: (id: number, title: string) => titles.set(id, title),
		subscriptionStates: () => subscriptions.map((subscription) => (subscription.active ? "open" : "closed")),
	};
}
