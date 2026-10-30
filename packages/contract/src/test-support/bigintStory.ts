import { Effect, Schema, Stream, SubscriptionRef } from "effect";
import * as AtomRegistry from "effect/reactivity/AtomRegistry";
import * as AtomRpc from "effect/reactivity/AtomRpc";
import * as Reactivity from "effect/reactivity/Reactivity";
import { RpcTest } from "effect/rpc";
import { collection, invalidationKeys } from "@shivaedev/changes/keys.ts";
import { storyKit } from "@shivaedev/test-story/server/storyKit.ts";
import { LiveConnection } from "#automaticLive.ts";
import { bind } from "#bind.ts";
import { contract } from "#contract.ts";
import { makeLiveServer } from "#makeLiveServer.ts";
import { query } from "#operation.ts";
import { type QueryReference, queryKeys } from "#serverMetadata.ts";
import { shown, times } from "./answers.ts";
import { type Mark, reRead } from "./reRead.ts";
import { settled } from "./settle.ts";

const records = collection("bigint-records", Schema.String);
const Get = query("get", {
	payload: { id: Schema.BigIntFromString },
	readPolicy: () => Effect.succeed(true),
	reads: ({ id }) => [records.item(String(id))],
	success: Schema.String,
});
const Records = contract("bigint-records", { queries: [Get] });

const bigintEngine = Effect.gen(function* () {
	const stored = new Map([
		[1n, "First"],
		[2n, "Second"],
	]);
	const reads = yield* SubscriptionRef.make<readonly bigint[]>([]);
	const subscriptions = yield* SubscriptionRef.make<readonly (readonly QueryReference[])[]>([]);
	const reactivity = yield* Reactivity.make;
	const live = yield* makeLiveServer.pipe(Effect.provideService(Reactivity.Reactivity, reactivity));
	const handlers = Records.toLayer({
		"bigint-records.$changes": ({ queries }) =>
			Stream.unwrap(
				Effect.map(queryKeys(Records.declaration.queries, queries), (keys) =>
					live
						.stream(keys)
						.pipe(
							Stream.onStart(SubscriptionRef.update(subscriptions, (all) => [...all, queries])),
							Stream.ensuring(SubscriptionRef.update(subscriptions, (all) => all.filter((current) => current !== queries))),
						),
				),
			),
		"bigint-records.get": ({ id }) =>
			Effect.as(
				SubscriptionRef.update(reads, (all) => [...all, id]),
				stored.get(id) ?? "Missing",
			),
	});
	class Client extends AtomRpc.Service<Client>()("test/BigintRecords", {
		group: Records,
		makeEffect: RpcTest.makeClient(Records, { flatten: true }),
		protocol: handlers,
	}) {}
	const registry = yield* Effect.acquireRelease(
		Effect.sync(() => AtomRegistry.make()),
		(current) => Effect.sync(() => current.dispose()),
	);
	const api = bind(Records, Client);
	registry.set(api[LiveConnection].coalesceWindow, 0);
	return { api, marked: new Map<bigint, Mark<string, unknown>>(), reactivity, reads, registry, stored, subscriptions, watched: new Set<bigint>() };
});
type BigintEngine = Effect.Success<typeof bigintEngine>;

function shownOf(engine: BigintEngine, id: bigint) {
	return Effect.map(settled(engine.registry, engine.api.get.query({ id })), (result) => shown(result, (value) => value));
}

function readsOf(reads: readonly bigint[], id: bigint) {
	return reads.filter((read) => read === id).length;
}

function referenceWords(reference: QueryReference) {
	const id = reference.payload !== null && typeof reference.payload === "object" && "id" in reference.payload ? reference.payload.id : undefined;
	return `${reference.query} by ${typeof id} id ${String(id)}`;
}

export const bigintStory = storyKit({
	clock: "live",
	create: () => bigintEngine,
	inspect: (engine) => ({
		reads: Effect.runSync(SubscriptionRef.get(engine.reads)).map(String),
		stored: [...engine.stored].map(([id, value]) => [String(id), value]),
	}),
	name: "bigint live queries",
	stages: ["views"],
	verbs: (engine, story) => ({
		announce: (id: bigint) => {
			story.tell(`the server announces a change to record ${id}`);
			const reads = Effect.runSync(SubscriptionRef.get(engine.reads));
			for (const watched of engine.watched) {
				engine.marked.set(watched, { reads: readsOf(reads, watched), shown: engine.registry.get(engine.api.get.query({ id: watched })) });
			}
			return engine.reactivity.invalidate(invalidationKeys([records.item(String(id))]));
		},
		changeQuietly: (id: bigint, value: string) => {
			story.tell(`record ${id} becomes ${value} on the server without any hint`);
			engine.stored.set(id, value);
		},
		shown: (id: bigint) => shownOf(engine, id),
		subscriptions: () => Effect.map(SubscriptionRef.get(engine.subscriptions), (all) => all.flatMap((queries) => queries.map(referenceWords))),
		timesRead: (id: bigint) =>
			Effect.andThen(
				shownOf(engine, id),
				Effect.map(SubscriptionRef.get(engine.reads), (reads) => `read ${times(readsOf(reads, id))}`),
			),
		untilReRead: (id: bigint) => {
			story.tell(`record ${id} is re-read and the new value reaches its view`);
			return reRead(
				engine.registry,
				engine.api.get.query({ id }),
				Stream.map(SubscriptionRef.changes(engine.reads), (reads) => readsOf(reads, id)),
				engine.marked.get(id),
			);
		},
	}),
});

export function watching(...ids: readonly bigint[]) {
	return bigintStory.trait("views", `the client mounts a query for each of the bigint ids ${ids.join(", ")} and reads each record once`, (engine) =>
		Effect.gen(function* () {
			for (const id of ids) {
				engine.registry.mount(engine.api.get.query({ id }));
				engine.watched.add(id);
			}
			for (const id of ids) {
				yield* shownOf(engine, id);
			}
		}),
	);
}
