import { Context, Effect, Layer, Ref, Schema } from "effect";
import { RpcMiddleware } from "effect/unstable/rpc";
import { collection, command, contract, fieldRejection, query } from "../src/index.ts";

export class Note extends Schema.Class<Note>("Note")({ id: Schema.Number, title: Schema.String, body: Schema.String }) {}
export const Draft = Schema.Struct({ title: Schema.String, body: Schema.String });
export class NoteMissing extends Schema.TaggedError<NoteMissing>()("NoteMissing", { id: Schema.Number }) {}
export class Denied extends Schema.TaggedError<Denied>()("Denied", {}) {}
export class Session extends Context.Service<Session, { readonly user: string }>()("test/Session") {}
export class Guard extends RpcMiddleware.Service<Guard, { provides: Session }>()("test/Guard", { error: Denied }) {}

export const notes = collection("notes", Note.fields.id);

export const Get = query("get", {
	payload: { id: Schema.Number },
	success: Note,
	rejections: { NoteMissing },
	reads: ({ id }) => [notes.item(id)],
});
export const List = query("list", { success: Schema.Array(Note), reads: () => [notes.list] });
export const Rename = command("rename", {
	payload: { id: Schema.Number, title: Schema.String },
	success: Note,
	rejections: { NoteMissing, Invalid: fieldRejection(Draft, ["title"]) },
	invalidates: ({ id }) => [notes.item(id)],
});
export const Create = command("create", {
	payload: Draft,
	success: Note,
	rejections: { Invalid: fieldRejection(Draft) },
	invalidates: (_draft, note) => [notes.item(note.id)],
});

export const Notes = contract("notes", { queries: [Get, List], commands: [Rename, Create] }).middleware(Guard);

export const makeServer = Effect.gen(function* () {
	const stored = yield* Ref.make(
		new Map([
			[1, new Note({ id: 1, title: "One", body: "" })],
			[2, new Note({ id: 2, title: "Two", body: "" })],
		]),
	);
	const reads = yield* Ref.make<ReadonlyArray<string>>([]);
	const denied = yield* Ref.make(false);
	const read = (label: string) => Ref.update(reads, (all) => [...all, label]);
	const find = (id: number) =>
		Effect.flatMap(Ref.get(stored), (all) => {
			const note = all.get(id);
			return note === undefined ? Get.reject.NoteMissing({ id }) : Effect.succeed(note);
		});
	const save = (note: Note) =>
		Effect.as(
			Ref.update(stored, (all) => new Map([...all, [note.id, note]])),
			note,
		);
	const handlers = Notes.toLayer(
		Effect.succeed(
			Notes.of({
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
				"notes.create": (draft) =>
					draft.title === ""
						? Create.reject.Invalid({ field: "title", message: "Enter a title" })
						: Effect.flatMap(Ref.get(stored), (all) => save(new Note({ id: all.size + 1, ...draft }))),
			}),
		),
	);
	const guard = Layer.succeed(Guard, (effect) =>
		Effect.flatMap(Ref.get(denied), (isDenied) => (isDenied ? Effect.fail(new Denied()) : Effect.provideService(effect, Session, { user: "ada" }))),
	);
	return { layer: Layer.merge(handlers, guard), reads, denied };
});
