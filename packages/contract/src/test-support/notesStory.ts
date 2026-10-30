import { Effect, Ref, SubscriptionRef } from "effect";
import type * as AsyncResult from "effect/reactivity/AsyncResult";
import type * as Atom from "effect/reactivity/Atom";
import { storyKit } from "@shivaedev/test-story/server/storyKit.ts";
import { LiveConnection } from "#automaticLive.ts";
import { answered, shown, times } from "./answers.ts";
import { type LocalEngine, localEngine } from "./localEngine.ts";
import type { Note } from "./notes.ts";
import { settled } from "./settle.ts";

export type View = "note 1" | "note 2" | "note 3" | "the list";

const NOTE_IDS = { "note 1": 1, "note 2": 2, "note 3": 3 } as const;

function readLabel(view: View) {
	return view === "the list" ? "list" : `get:${NOTE_IDS[view]}`;
}

function viewAtom(engine: LocalEngine, view: View): Atom.Atom<AsyncResult.AsyncResult<Note | readonly Note[], unknown>> {
	return view === "the list" ? engine.api.list.query(undefined) : engine.api.get.query({ id: NOTE_IDS[view] });
}

function titles(value: Note | readonly Note[]): string | readonly string[] {
	if (Array.isArray(value)) {
		return value.map((note) => note.title);
	}
	return "title" in value ? value.title : "";
}

function shownOf(engine: LocalEngine, view: View) {
	return Effect.map(settled(engine.registry, viewAtom(engine, view)), (result) => shown(result, titles));
}

export const notesStory = storyKit({
	clock: "live",
	create: () => localEngine,
	inspect: ({ server }) => ({
		reads: Effect.runSync(SubscriptionRef.get(server.reads)),
		stored: [...Effect.runSync(Ref.get(server.stored)).values()],
		subscriptions: Effect.runSync(Ref.get(server.subscriptions)),
	}),
	name: "notes",
	stages: ["connection", "views"],
	verbs: (engine, story) => ({
		create: (title: string) => {
			story.tell(`the client creates the note ${title}`);
			return answered(engine.run(engine.api.create.run({ body: "", title })), (note) => `created note ${note.id} titled ${note.title}`);
		},
		mount: (view: View) => {
			story.tell(`the client mounts ${view}`);
			engine.registry.mount(viewAtom(engine, view));
		},
		prepare: (view: View) => {
			story.tell(`the client prepares ${view} without mounting it`);
			viewAtom(engine, view);
		},
		rename: (id: number, title: string) => {
			story.tell(`the client renames note ${id} to ${JSON.stringify(title)}`);
			return answered(engine.run(engine.api.rename.run({ id, title })), (note) => `renamed note ${note.id} to ${note.title}`);
		},
		serverReads: () => SubscriptionRef.get(engine.server.reads),
		shown: (view: View) => shownOf(engine, view),
		subscriptions: () => Ref.get(engine.server.subscriptions),
		timesRead: (view: View) =>
			Effect.andThen(
				shownOf(engine, view),
				Effect.map(SubscriptionRef.get(engine.server.reads), (reads) => `read ${times(reads.filter((read) => read === readLabel(view)).length)}`),
			),
	}),
});

export function liveConnectionOpen() {
	return notesStory.trait("connection", "the client's live connection is open", (engine) => {
		engine.registry.mount(engine.api[LiveConnection].connection);
	});
}

export function watching(...views: readonly View[]) {
	return notesStory.trait("views", `the client watches ${views.join(", ")}, each read once`, function* (engine) {
		for (const view of views) {
			engine.registry.mount(viewAtom(engine, view));
		}
		for (const view of views) {
			yield* shownOf(engine, view);
		}
	});
}
