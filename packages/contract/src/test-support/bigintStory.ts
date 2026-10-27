import { Effect, Schema, Stream } from "effect";
import * as AsyncResult from "effect/reactivity/AsyncResult";
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
	const subscriptions = new Set<readonly QueryReference[]>();
	const reactivity = yield* Reactivity.make;
	const live = yield* makeLiveServer.pipe(Effect.provideService(Reactivity.Reactivity, reactivity));
	const handlers = Records.toLayer({
		"bigint-records.$changes": ({ queries }) =>
			Stream.unwrap(
				Effect.map(queryKeys(Records.declaration.queries, queries), (keys) =>
					live
						.stream(keys)
						.pipe(Stream.onStart(Effect.sync(() => subscriptions.add(queries))), Stream.ensuring(Effect.sync(() => subscriptions.delete(queries)))),
				),
			),
		"bigint-records.get": ({ id }) => Effect.sync(() => stored.get(id) ?? "Missing"),
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
	return { api, reactivity, registry, stored, subscriptions };
});

export const bigintStory = storyKit({
	clock: "live",
	create: () => bigintEngine,
	inspect: (engine) => ({ stored: [...engine.stored], subscriptions: [...engine.subscriptions] }),
	name: "bigint live queries",
	stages: [],
	verbs: (engine, story) => ({
		announce: (id: bigint) => engine.reactivity.invalidate(invalidationKeys([records.item(String(id))])),
		connect: () => {
			story.tell("connect the live query stream");
			engine.registry.set(engine.api[LiveConnection].coalesceWindow, 0);
			return engine.registry.mount(engine.api[LiveConnection].connection);
		},
		query: (id: bigint) => engine.api.get.query({ id }),
		store: (id: bigint, value: string) =>
			Effect.sync(() => {
				engine.stored.set(id, value);
			}),
		subscriptions: () => Effect.sync(() => [...engine.subscriptions]),
		value: (atom: ReturnType<typeof engine.api.get.query>) => Effect.sync(() => AsyncResult.getOrElse(engine.registry.get(atom), () => undefined)),
		watch: (atom: ReturnType<typeof engine.api.get.query>) => {
			story.tell("watch a bigint record query");
			return engine.registry.mount(atom);
		},
	}),
});
