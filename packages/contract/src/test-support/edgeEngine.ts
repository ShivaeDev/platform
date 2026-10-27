import { Effect, Option, Schema, Stream } from "effect";
import * as AtomRegistry from "effect/reactivity/AtomRegistry";
import * as AtomRpc from "effect/reactivity/AtomRpc";
import { RpcTest } from "effect/rpc";
import { bind } from "#bind.ts";
import { contract } from "#contract.ts";
import { stream } from "#operation.ts";
import { Get, List } from "./notes.ts";

export const Follow = stream("follow", {
	payload: Schema.Struct({ id: Schema.Number }),
	reads: ({ id }) => Get.reads({ id }, Option.none()),
	success: Schema.String,
});
const Plain = contract("plain", { queries: [List] });
const Feed = contract("feed", { streams: [Follow] });

export function edgeEngine(registry: AtomRegistry.AtomRegistry) {
	class PlainClient extends AtomRpc.Service<PlainClient>()("test/PlainClient", {
		group: Plain,
		makeEffect: RpcTest.makeClient(Plain, { flatten: true }),
		protocol: Plain.toLayer(Effect.succeed(Plain.of({ "plain.$changes": () => Stream.never, "plain.list": () => Effect.succeed([]) }))),
	}) {}
	class FeedClient extends AtomRpc.Service<FeedClient>()("test/FeedClient", {
		group: Feed,
		makeEffect: RpcTest.makeClient(Feed, { flatten: true }),
		protocol: Feed.toLayer({ "feed.$changes": () => Stream.never, "feed.follow": ({ id }) => Stream.make(`note:${id}`, "done") }),
	}) {}
	return {
		follow: (id: number) => AtomRegistry.getResult(registry, FeedClient.runtime.atom(Stream.runCollect(bind(Feed, FeedClient).follow.run({ id })))),
		plainList: () => AtomRegistry.getResult(registry, PlainClient.runtime.atom(bind(Plain, PlainClient).list.run(undefined))),
	};
}
