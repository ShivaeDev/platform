import { Effect, Layer, Ref, Stream, SubscriptionRef } from "effect";
import type { QueryReference } from "#serverMetadata.ts";
import { Create, Denied, Get, Guard, Note, Notes, Rename, Session } from "./notes.ts";

export const notesServer = Effect.gen(function* () {
	const stored = yield* Ref.make(
		new Map([
			[1, new Note({ body: "", id: 1, title: "One" })],
			[2, new Note({ body: "", id: 2, title: "Two" })],
		]),
	);
	const reads = yield* SubscriptionRef.make<readonly string[]>([]);
	const subscriptions = yield* Ref.make<readonly QueryReference[]>([]);
	const denied = yield* Ref.make(false);
	const session = yield* Ref.make({ user: "ada" });
	function read(label: string) {
		return SubscriptionRef.update(reads, (all) => [...all, label]);
	}
	function find(id: number) {
		return Effect.flatMap(Ref.get(stored), (all) => {
			const note = all.get(id);
			return note === undefined ? Get.reject.NoteMissing({ id }) : Effect.succeed(note);
		});
	}
	function save(note: Note) {
		return Effect.as(
			Ref.update(stored, (all) => new Map([...all, [note.id, note]])),
			note,
		);
	}
	const implementation = Notes.of({
		"notes.$changes": ({ queries }) =>
			Stream.unwrap(Effect.as(Ref.set(subscriptions, queries), Stream.concat(Stream.succeed({ _tag: "Resync" } as const), Stream.never))),
		"notes.create": (draft) =>
			draft.title === ""
				? Create.reject.Invalid({ field: "title", message: "Enter a title" })
				: Effect.flatMap(Ref.get(stored), (all) => save(new Note({ id: all.size + 1, ...draft }))),
		"notes.get": ({ id }) => Effect.andThen(read(`get:${id}`), find(id)),
		"notes.list": () =>
			Effect.andThen(
				read("list"),
				Effect.map(Ref.get(stored), (all) => [...all.values()]),
			),
		"notes.rename": ({ id, title }) =>
			title.trim() === ""
				? Rename.reject.Invalid({ field: "title", message: "Enter a title" })
				: Effect.flatMap(find(id), (note) => save(new Note({ ...note, title }))),
	});
	const handlers = Notes.toLayer(Effect.succeed(implementation));
	const guard = Layer.succeed(Guard, (effect) =>
		Effect.flatMap(Ref.get(denied), (isDenied) =>
			isDenied ? Effect.fail(new Denied()) : Effect.flatMap(Ref.get(session), (identity) => Effect.provideService(effect, Session, identity)),
		),
	);
	return { denied, guard, implementation, layer: Layer.merge(handlers, guard), reads, session, stored, subscriptions };
});
