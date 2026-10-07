import { Context, Effect, Layer, Ref, Schema } from "effect";
import { RpcMiddleware } from "effect/unstable/rpc";
import { contract } from "#contract.ts";
import { collection } from "#keys.ts";
import { command, query } from "#operation.ts";
import { fieldRejection } from "#rejection.ts";

export class Note extends Schema.Class<Note>("Note")({ body: Schema.String, id: Schema.Number, title: Schema.String }) {}
export const Draft = Schema.Struct({ body: Schema.String, title: Schema.String });
export class NoteMissing extends Schema.TaggedError<NoteMissing>()("NoteMissing", { id: Schema.Number }) {}
export class Denied extends Schema.TaggedError<Denied>()("Denied", {}) {}
export class Session extends Context.Service<Session, { readonly user: string }>()("test/Session") {}
export class Guard extends RpcMiddleware.Service<Guard, { provides: Session }>()("test/Guard", { error: Denied }) {}

export const notes = collection("notes", Note.fields.id);

export const Get = query("get", {
	payload: { id: Schema.Number },
	reads: ({ id }) => [notes.item(id)],
	rejections: { NoteMissing },
	success: Note,
});
export const List = query("list", { reads: () => [notes.list], success: Schema.Array(Note) });
export const Rename = command("rename", {
	invalidates: ({ id }) => [notes.item(id)],
	payload: { id: Schema.Number, title: Schema.String },
	rejections: { Invalid: fieldRejection(Draft, ["title"]), NoteMissing },
	success: Note,
});
export const Create = command("create", {
	invalidates: (_draft, note) => [notes.item(note.id)],
	payload: Draft,
	rejections: { Invalid: fieldRejection(Draft) },
	success: Note,
});

export const Notes = contract("notes", { commands: [Rename, Create], queries: [Get, List] }).middleware(Guard);

export const makeServer = Effect.gen(function* () {
	const stored = yield* Ref.make(
		new Map([
			[1, new Note({ body: "", id: 1, title: "One" })],
			[2, new Note({ body: "", id: 2, title: "Two" })],
		]),
	);
	const reads = yield* Ref.make<readonly string[]>([]);
	const denied = yield* Ref.make(false);
	function read(label: string) {
		return Ref.update(reads, (all) => [...all, label]);
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
	const handlers = Notes.toLayer(
		Effect.succeed(
			Notes.of({
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
			}),
		),
	);
	const guard = Layer.succeed(Guard, (effect) =>
		Effect.flatMap(Ref.get(denied), (isDenied) => (isDenied ? Effect.fail(new Denied()) : Effect.provideService(effect, Session, { user: "ada" }))),
	);
	return { denied, layer: Layer.merge(handlers, guard), reads };
});
