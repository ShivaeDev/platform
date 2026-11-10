import { Effect, Option, Ref, Schema, Stream } from "effect";
import { storyKit } from "@shivaedev/test-story/server/storyKit.ts";
import type { QueryUpdate } from "#queryUpdate.ts";
import { answered, updateWords } from "#test/answers.ts";
import { moduleEngine, type Outage, type Person } from "#test/moduleEngine.ts";
import { Note } from "#test/moduleNotes.ts";

function titled(note: { readonly id: number; readonly title: string }) {
	return `note ${note.id}: ${note.title}`;
}

function pushed(update: QueryUpdate) {
	return update._tag === "Result"
		? Option.match(Schema.decodeUnknownOption(Note)(update.value), { onNone: () => "an undecodable result", onSome: titled })
		: updateWords(update);
}

export const moduleStory = storyKit({
	clock: "test",
	create: () => moduleEngine,
	inspect: ({ heard, state }) => ({ heard, state }),
	name: "a defined module served by its handlers",
	stages: ["notes", "store"],
	verbs: (engine, story) => ({
		create: (person: Person, title: string) => {
			story.tell(`${person} creates a note titled ${title} over HTTP RPC`);
			return answered(
				Effect.flatMap(engine.overHttp(person), (client) => client("moduleNotes.create", { title })),
				titled,
			);
		},
		heardAnnouncements: () => Effect.sync(() => [...engine.heard]),
		list: (person: Person) => {
			story.tell(`${person} lists their notes over HTTP RPC`);
			return answered(
				Effect.flatMap(engine.overHttp(person), (client) => client("moduleNotes.list", undefined)),
				(notes) => notes.map(titled).join(", "),
			);
		},
		operationSpans: () => Effect.sync(() => engine.spans.filter((name) => name.startsWith("ModuleNotes."))),
		read: (person: Person, id: number) => {
			story.tell(`${person} reads note ${id} over HTTP RPC`);
			return answered(
				Effect.flatMap(engine.overHttp(person), (client) => client("moduleNotes.get", { id })),
				titled,
			);
		},
		subscribe: (person: Person, id: number) => {
			story.tell(`${person} subscribes to note ${id} over WebSocket`);
			return answered(
				Effect.flatMap(engine.overSocket(), (client) =>
					Stream.runHead(client("moduleNotes.$changes", { queries: [{ payload: { id }, query: "get" }] }, { headers: engine.viewerHeaders(person) })),
				),
				(update) =>
					Option.match(update, {
						onNone: () => "ended without a result",
						onSome: pushed,
					}),
			);
		},
	}),
});

export function noteStored(owner: Person, title: string) {
	return moduleStory.trait("notes", `the store holds ${owner}'s note titled ${title}`, (engine) =>
		Ref.update(engine.stored, (notes) => [...notes, { id: notes.length + 1, owner, title }]),
	);
}

export function storeFails(outage: Exclude<Outage, "none">) {
	const words = outage === "unavailable" ? "the notes store is unavailable and says to retry" : "the notes store has a bug that crashes it";
	return moduleStory.trait("store", words, (engine) => {
		engine.state.outage = outage;
	});
}
