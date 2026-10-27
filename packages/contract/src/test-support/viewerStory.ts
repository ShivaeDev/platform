import { type Duration, Effect, Ref, Stream } from "effect";
import type { Rpc, RpcGroup } from "effect/rpc";
import { storyKit } from "@shivaedev/test-story/server/storyKit.ts";
import type { LiveHint } from "#live.ts";
import { heard, watchHints } from "#testing.ts";
import { type Notes, viewerEngine } from "./viewerEngine.ts";
import { viewerPage } from "./viewerPage.ts";

export const viewerStory = storyKit({
	clock: "live",
	create: () => viewerEngine,
	inspect: (engine) => ({ stored: [...Effect.runSync(Ref.get(engine.stored)).values()] }),
	name: "viewer-scoped hints",
	stages: [],
	verbs: (engine, story) => ({
		checks: () => Effect.runSync(Ref.get(engine.checks)),
		get: (viewer: string, id: number) => {
			story.tell(`${viewer} reads note ${id}`);
			return engine.client("notes.get", { id }, { headers: { viewer } });
		},
		heard,
		list: (viewer: string) => {
			story.tell(`${viewer} lists visible notes`);
			return engine.client("notes.list", undefined, { headers: { viewer } });
		},
		listen: (viewer: string, queries: Rpc.Payload<Rpc.ExtractTag<RpcGroup.Rpcs<typeof Notes>, "notes.$changes">>["queries"]) =>
			watchHints(engine.client("notes.$changes", { queries }, { headers: { viewer } })),
		memoWindow: (window: Duration.Input) => Ref.set(engine.memoWindow, window),
		openPage: (viewer: string, id: number) => {
			story.tell(`${viewer} opens the page for note ${id}`);
			return viewerPage(engine, viewer, id);
		},
		policyOutage: (unavailable: boolean) => {
			story.tell(unavailable ? "the policy service stops answering" : "the policy service recovers");
			return Ref.set(engine.unavailable, unavailable);
		},
		rename: (viewer: string, id: number, title: string) => {
			story.tell(`${viewer} renames note ${id} to ${title}`);
			return engine.client("notes.rename", { id, title }, { headers: { viewer } });
		},
		resync: () => engine.live.resync,
		watch: (
			viewer: string | undefined,
			queries: Rpc.Payload<Rpc.ExtractTag<RpcGroup.Rpcs<typeof Notes>, "notes.$changes">>["queries"],
			received: LiveHint[],
		) => {
			story.tell(`${viewer} subscribes to change hints`);
			return engine
				.client("notes.$changes", { queries }, { headers: viewer === undefined ? {} : { viewer } })
				.pipe(Stream.runForEach((hint) => Effect.sync(() => received.push(hint))));
		},
	}),
});
