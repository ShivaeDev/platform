import { Effect, Ref, SubscriptionRef } from "effect";
import type * as AsyncResult from "effect/reactivity/AsyncResult";
import type * as Atom from "effect/reactivity/Atom";
import type { Note } from "@shivaedev/test-kits/test-support/notes/model.ts";
import { withIsolatedDatabase } from "@shivaedev/test-sql/server/withIsolatedDatabase.ts";
import { storyKit } from "@shivaedev/test-story/server/storyKit.ts";
import { LiveConnection } from "#automaticLive.ts";
import { answered, shown, times } from "#test/answers.ts";
import { type LocalEngine, localEngine } from "#test/localEngine.ts";
import { notesDatabase } from "#test/notesDatabase.ts";
import { READER } from "#test/notesServer.ts";
import { markQuery, reRead } from "#test/reRead.ts";
import { settled } from "#test/settled.ts";

export type View = "note 1" | "note 2" | "note 3" | "the list";

const NOTE_IDS = { "note 1": 1, "note 2": 2, "note 3": 3 } as const;

function readLabel(view: View) {
	return view === "the list" ? "list" : `get:${NOTE_IDS[view]}`;
}

function viewAtom(engine: LocalEngine, view: View): Atom.Atom<AsyncResult.AsyncResult<Note | readonly Note[], unknown>> {
	return view === "the list" ? engine.api.list.query({ owner: READER }) : engine.api.get.query({ id: NOTE_IDS[view] });
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

function write(engine: LocalEngine, effect: Effect.Effect<Note, unknown>) {
	const watched = (["note 1", "note 2", "note 3", "the list"] as const)
		.map((view) => ({ atom: viewAtom(engine, view), view }))
		.filter(({ atom }) => engine.registry.getNodes().has(atom))
		.map((entry) => ({ ...entry, mark: markQuery(engine.registry, entry.atom) }));
	return effect.pipe(
		Effect.tap((note) =>
			Effect.forEach(
				watched.filter(({ view }) => view === "the list" || NOTE_IDS[view] === note.id),
				({ atom, mark }) => reRead(engine.registry, atom, mark),
			),
		),
	);
}

export const notesStory = storyKit({
	around: withIsolatedDatabase,
	clock: "test",
	create: () => localEngine,
	inspect: ({ server }) => ({
		reads: Effect.runSync(SubscriptionRef.get(server.reads)),
		subscriptions: Effect.runSync(Ref.get(server.subscriptions)),
	}),
	layer: notesDatabase.layer,
	name: "notes",
	runIf: notesDatabase.configured,
	stages: ["connection", "views"],
	verbs: (engine, story) => ({
		create: (title: string) => {
			story.tell(`the client creates the note ${title}`);
			return answered(write(engine, engine.run(engine.api.create.run({ title }))), (note) => `created note ${note.id} titled ${note.title}`);
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
			return answered(write(engine, engine.run(engine.api.rename.run({ id, title }))), (note) => `renamed note ${note.id} to ${note.title}`);
		},
		serverReads: () => Effect.map(SubscriptionRef.get(engine.server.reads), (reads) => reads.toSorted()),
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
