import { Deferred, Effect, Stream, SubscriptionRef } from "effect";
import * as AtomRegistry from "effect/reactivity/AtomRegistry";
import * as AtomRpc from "effect/reactivity/AtomRpc";
import { RpcTest } from "effect/rpc";
import { readKeys } from "@shivaedev/changes/keys.ts";
import { storyKit } from "@shivaedev/test-story/server/storyKit.ts";
import { live } from "#live.ts";
import { hintWords, shown } from "./answers.ts";
import { settled, signal } from "./settle.ts";
import { Notes, notes, viewerEngine } from "./viewerEngine.ts";

const slowConsumerEngine = Effect.gen(function* () {
	const server = yield* viewerEngine;
	const stalled = yield* Deferred.make<void>();
	const resumed = yield* Deferred.make<void>();
	const received = yield* SubscriptionRef.make<readonly string[]>([]);
	class Client extends AtomRpc.Service<Client>()("test/SlowConsumer", {
		group: Notes,
		makeEffect: RpcTest.makeClient(Notes, { flatten: true }),
		protocol: server.layerFor("alice"),
	}) {}
	const registry = yield* Effect.acquireRelease(
		Effect.sync(() => AtomRegistry.make()),
		(current) => Effect.sync(() => current.dispose()),
	);
	const query = Client.query("notes.list", { title: "" }, { reactivityKeys: readKeys([notes.bucket.userId("alice")], { scope: "alice" }) });
	const stream = Stream.transformPull(server.live.stream([notes.bucket.userId("alice")], { scope: "alice" }), (pull) =>
		Effect.sync(() => {
			let initial = true;
			return Effect.gen(function* () {
				if (!initial) {
					yield* Deferred.succeed(stalled, undefined);
					yield* Deferred.await(resumed);
				}
				initial = false;
				const hints = yield* pull;
				yield* SubscriptionRef.update(received, (all) => [...all, ...hints.map(hintWords)]);
				return hints;
			});
		}),
	);
	const connection = live(Client.runtime, {
		coalesceWindow: 0,
		keyContext: { scope: "alice" },
		resyncKeys: [notes.bucket.userId("alice")],
		stream,
	});
	registry.mount(query);
	registry.mount(connection.connection);
	yield* Deferred.await(stalled);
	yield* settled(registry, query);
	const initialReads = (yield* SubscriptionRef.get(server.reads)).length;
	return { initialReads, query, received, registry, resumed, server };
});

export const slowConsumer = storyKit({
	clock: "live",
	create: () => slowConsumerEngine,
	inspect: (engine) => ({ received: Effect.runSync(SubscriptionRef.get(engine.received)) }),
	name: "slow live consumer",
	stages: [],
	verbs: (engine, story) => ({
		received: () => SubscriptionRef.get(engine.received),
		renameRepeatedly: (count: number) =>
			Effect.gen(function* () {
				story.tell(`alice renames note 1 ${count} times while the live consumer is stalled`);
				for (let edit = 1; edit <= count; edit += 1) {
					yield* engine.server.client("notes.rename", { id: 1, title: `Edit ${edit}` }, { headers: { viewer: "alice" } });
					// Separate flushes exercise queue overflow rather than synchronous key batching.
					yield* Effect.promise(() => Promise.resolve());
				}
			}),
		resume: () => {
			story.tell("the stalled consumer resumes pulling the server's pending hints");
			return Deferred.succeed(engine.resumed, undefined);
		},
		shown: () => Effect.map(settled(engine.registry, engine.query), (result) => shown(result, (rows) => rows.map((row) => row.title))),
		untilReRead: () => {
			story.tell("alice's notes are read again after delivery resumes");
			return signal(SubscriptionRef.changes(engine.server.reads), (reads) => reads.length > engine.initialReads);
		},
	}),
});
