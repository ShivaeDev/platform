import { Effect, Ref, Stream } from "effect";
import { storyKit } from "@shivaedev/test-story/server/storyKit.ts";
import type { Key } from "#keys.ts";
import type { LiveHint } from "#live.ts";
import { viewerEngine } from "./viewerEngine.ts";

export const viewerStory = storyKit({
	clock: "live",
	create: () => viewerEngine,
	inspect: (engine) => ({ stored: [...Effect.runSync(Ref.get(engine.stored)).values()] }),
	name: "viewer-scoped hints",
	stages: [],
	verbs: ({ client, live }, story) => ({
		get: (viewer: string, id: number) => {
			story.tell(`${viewer} reads note ${id}`);
			return client("notes.get", { id }, { headers: { viewer } });
		},
		list: (viewer: string) => {
			story.tell(`${viewer} lists visible notes`);
			return client("notes.list", undefined, { headers: { viewer } });
		},
		rename: (viewer: string, id: number, title: string) => {
			story.tell(`${viewer} renames note ${id} to ${title}`);
			return client("notes.rename", { id, title }, { headers: { viewer } });
		},
		resync: () => live.resync,
		watch: (viewer: string, keys: readonly Key[], received: LiveHint[]) => {
			story.tell(`${viewer} subscribes to change hints`);
			return client("notes.$changes", { keys }, { headers: { viewer } }).pipe(Stream.runForEach((hint) => Effect.sync(() => received.push(hint))));
		},
	}),
});
