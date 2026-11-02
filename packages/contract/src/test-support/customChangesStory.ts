import { Context, Effect, Layer, Option, Schema, Stream } from "effect";
import * as Reactivity from "effect/reactivity/Reactivity";
import { RpcTest } from "effect/rpc";
import { storyKit } from "@shivaedev/test-story/server/storyKit.ts";
import { changesHandlerLayer } from "#changesHandlerLayer.ts";
import { contract } from "#contract.ts";
import { makeLiveServer } from "#makeLiveServer.ts";
import { command, query } from "#operation.ts";
import { querySubscription } from "#querySubscription.ts";
import { answered } from "./answers.ts";

class Unavailable extends Schema.TaggedError<Unavailable>()("Unavailable", {}) {}
class Counter extends Context.Service<Counter, { value: bigint; unavailable: boolean }>()("test/CustomChangesCounter") {}
const Api = contract("counter", {
	commands: [command("set", { invalidates: () => [], payload: { value: Schema.BigIntFromString } })],
	queries: [
		query("read", {
			live: "rerun-and-compare",
			readPolicy: () => Effect.succeed(true),
			reads: () => [],
			rejections: { Unavailable },
			success: Schema.BigIntFromString,
		}),
	],
});
const read = Effect.flatMap(Counter, (counter) => (counter.unavailable ? Effect.fail(new Unavailable()) : Effect.succeed(counter.value)));

const customChangesEngine = Effect.gen(function* () {
	const counter = { unavailable: false, value: 0n };
	const live = yield* makeLiveServer.pipe(Effect.provide(Reactivity.layer));
	const handlers = Layer.merge(
		Api.application.toLayer({
			"counter.read": () => read,
			"counter.set": ({ value }) =>
				Effect.map(Counter, (store) => {
					store.value = value;
				}),
		}),
		changesHandlerLayer(
			Api,
			(rpc) =>
				({ queries }) =>
					Stream.unwrap(
						Effect.gen(function* () {
							const subscription = yield* querySubscription(rpc, queries, Option.none());
							return live.subscribe(subscription, () => read);
						}),
					),
		),
	).pipe(Layer.provide(Layer.succeed(Counter, counter)));
	const client = yield* RpcTest.makeClient(Api, { flatten: true }).pipe(Effect.provide(handlers));
	return { client, counter };
});

export const customChangesStory = storyKit({
	create: () => customChangesEngine,
	name: "custom contract changes handler",
	stages: [],
	verbs: (engine, story) => ({
		failReads: () =>
			Effect.sync(() => {
				engine.counter.unavailable = true;
			}),
		set: (value: bigint) => {
			story.tell(`set the counter to ${value}`);
			return engine.client("counter.set", { value });
		},
		subscribedValue: () => {
			story.tell("subscribe to the counter through the contract-derived Layer");
			return answered(engine.client("counter.$changes", { queries: [{ payload: undefined, query: "read" }] }).pipe(Stream.runHead), (update) =>
				Option.isSome(update) && update.value._tag === "Result" ? `${typeof update.value.value} ${update.value.value}` : "no counter value",
			);
		},
	}),
});
