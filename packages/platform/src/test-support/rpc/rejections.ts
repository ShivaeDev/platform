import { Effect, Layer } from "effect";
import { RpcClient } from "effect/rpc";
import { storyKit } from "@shivaedev/test-story/storyKit.ts";
import { requestTracingLayer } from "#rpc-server/tracing.ts";
import { httpClient, recorder, rpcHttp, serve } from "./harness.ts";
import { Profiles, Handlers as RenameHandlers } from "./renameFixture.ts";
import { Api, Handlers as SaveHandlers } from "./saveFixture.ts";

const Group = Profiles.merge(Api);
export const rejections = storyKit({
	clock: "live",
	*create() {
		const recorded = recorder();
		const app = serve(
			rpcHttp(Group).pipe(Layer.provide(Layer.mergeAll(SaveHandlers, RenameHandlers, requestTracingLayer())), Layer.provide(recorded.layer)),
		);
		yield* Effect.addFinalizer(() => Effect.promise(() => app.dispose()));
		const client = yield* RpcClient.make(Group).pipe(Effect.provide(httpClient(app, {})));
		return { client, ...recorded };
	},
	name: "RPC rejection",
	stages: ["configured"],
	verbs: (state, story) => ({
		rename: (name: string) => {
			story.tell(`an anonymous caller renames a profile to ${JSON.stringify(name)} over HTTP`);
			return Effect.flip(state.client.Rename({ name }));
		},
		save: (mode: string) => {
			story.tell(`an anonymous caller saves in ${mode} mode over HTTP`);
			return Effect.flip(state.client.Save({ mode }));
		},
		spans: () => state.spans,
	}),
});
