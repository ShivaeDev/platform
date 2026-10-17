import { Effect, Ref } from "effect";
import type * as Atom from "effect/reactivity/Atom";
import * as Reactivity from "effect/reactivity/Reactivity";
import { storyKit } from "@shivaedev/test-story/storyKit.ts";
import { edgeEngine } from "./edgeEngine.ts";
import { localEngine } from "./localEngine.ts";
import type { Note } from "./notes.ts";

export const notesStory = storyKit({
	clock: "live",
	create: () => localEngine,
	inspect: ({ server }) => ({
		denied: Effect.runSync(Ref.get(server.denied)),
		reads: Effect.runSync(Ref.get(server.reads)),
		session: Effect.runSync(Ref.get(server.session)),
		stored: [...Effect.runSync(Ref.get(server.stored)).values()],
	}),
	name: "notes",
	stages: ["session", "notes"],
	verbs: (engine, story) => ({
		create: (title: string, body = "") => {
			story.tell(`create the note ${title}`);
			return engine.run(engine.api.create.run({ body, title }));
		},
		deny: () => {
			story.tell("deny further requests");
			return Ref.set(engine.server.denied, true);
		},
		follow: (id: number) => {
			story.tell(`follow note ${id}`);
			return edgeEngine(engine.registry).follow(id);
		},
		get: (id: number) => {
			story.tell(`read note ${id} once`);
			return engine.run(engine.api.get.run({ id }));
		},
		invalidate: (keys: Parameters<typeof Reactivity.invalidate>[0]) => engine.run(Reactivity.invalidate(keys)),
		invalidations: () => [...engine.invalidations],
		list: () => {
			story.tell("list the notes once");
			return engine.run(engine.api.list.run(undefined));
		},
		mount: <A>(atom: Atom.Atom<A>) => engine.registry.mount(atom),
		plainList: () => {
			story.tell("read the contract without middleware");
			return edgeEngine(engine.registry).plainList();
		},
		query: (id: number) => engine.api.get.query({ id }),
		queryList: () => engine.api.list.query(undefined),
		reads: () => Effect.runSync(Ref.get(engine.server.reads)),
		registry: engine.registry,
		rename: (id: number, title: string) => {
			story.tell(`rename note ${id} to ${JSON.stringify(title)}`);
			return engine.run(engine.api.rename.run({ id, title }));
		},
		watchKeys: (label: string, keys: readonly string[], refreshed: string[]) =>
			engine.run(
				Effect.gen(function* () {
					const reactivity = yield* Reactivity.Reactivity;
					return reactivity.registerUnsafe(keys, () => refreshed.push(label));
				}),
			),
	}),
});

export function signedIn(user = "ada") {
	return notesStory.trait("session", `${user} has a session`, (engine) => Ref.set(engine.server.session, { user }));
}
export function denied() {
	return notesStory.trait("session", "the session is denied", (engine) => Ref.set(engine.server.denied, true));
}
export function storedNotes(...values: readonly Note[]) {
	return notesStory.trait("notes", `the store has notes ${values.map(({ id }) => id).join(", ")}`, (engine) =>
		Ref.set(engine.server.stored, new Map(values.map((note) => [note.id, note]))),
	);
}
