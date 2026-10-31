import { Effect, Layer, Option, Schema, Stream } from "effect";
import * as Reactivity from "effect/reactivity/Reactivity";
import { RpcMiddleware, RpcTest } from "effect/rpc";
import { storyKit } from "@shivaedev/test-story/server/storyKit.ts";
import { contract } from "#contract.ts";
import { makeLiveServer } from "#makeLiveServer.ts";
import { query } from "#operation.ts";
import { querySubscription } from "#querySubscription.ts";
import { authorizeReads, CurrentViewer, signedIn } from "#readPolicy.ts";
import { MissingReadPolicy, QueryReadDenied } from "#readPolicyErrors.ts";
import { answered } from "./answers.ts";

class Guard extends RpcMiddleware.Service<Guard>()("test/NativePolicyGuard", { error: Schema.Union([MissingReadPolicy, QueryReadDenied]) }) {}
type Viewer = "alice" | "signed out";
function headers(viewer: Viewer) {
	return viewer === "signed out" ? {} : { viewer };
}

export const policyFallbackStory = storyKit({
	clock: "live",
	*create() {
		const read = query("read", { readPolicy: signedIn, reads: () => [], success: Schema.String });
		const Reads = contract("reads", { queries: [read] }).middleware(Guard);
		const live = yield* makeLiveServer.pipe(Effect.provide(Reactivity.layer));
		const handlers = Reads.toLayer({
			"reads.$changes": ({ queries }, { rpc }) =>
				Stream.unwrap(
					Effect.gen(function* () {
						const subscription = yield* querySubscription(rpc, queries, yield* CurrentViewer);
						return live.subscribe(subscription);
					}),
				),
			"reads.read": () => Effect.succeed("A note"),
		});
		const guard = Layer.succeed(Guard, (effect, request) =>
			authorizeReads(
				effect,
				request,
				Option.map(Option.fromUndefinedOr(request.headers.viewer), (id) => ({ id })),
			),
		);
		const client = yield* RpcTest.makeClient(Reads, { flatten: true }).pipe(Effect.provide(Layer.merge(handlers, guard)));
		return { client, read };
	},
	name: "native RPC read policies",
	stages: ["declarations"],
	verbs: (engine, story) => ({
		read: (viewer: Viewer) => {
			story.tell(`${viewer} makes a plain RPC read through a native server without the host boot check`);
			return answered(engine.client("reads.read", undefined, { headers: headers(viewer) }), (value) => value);
		},
		subscribe: (viewer: Viewer) => {
			story.tell(`${viewer} subscribes through a native server without the host boot check`);
			return answered(
				Stream.runHead(engine.client("reads.$changes", { queries: [{ payload: undefined, query: "read" }] }, { headers: headers(viewer) })),
				() => "subscribed",
			);
		},
	}),
});

export const missingPolicy = policyFallbackStory.trait("declarations", "an untyped query omits its read policy", (engine) => {
	Reflect.deleteProperty(engine.read, "readPolicy");
});
