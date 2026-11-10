import { Context, Data, Effect, Option, Schema } from "effect";
import { RpcMiddleware } from "effect/rpc";
import { collection } from "@shivaedev/changes/keys.ts";
import { NotFound, Unauthorized } from "@shivaedev/errors/taxonomy.ts";
import { defineModule } from "#defineModule.ts";
import { command, query } from "#operation.ts";
import { CurrentViewer } from "#readPolicy.ts";
import { fieldRejection } from "#rejection.ts";

export const moduleNotes = collection("moduleNotes", Schema.Number);
export const NoteFields = Schema.Struct({ title: Schema.String });
export const Note = Schema.Struct({ id: Schema.Number, title: Schema.String });

export interface StoredNote {
	readonly id: number;
	readonly owner: string;
	readonly title: string;
}

export class TitleTaken extends Schema.TaggedError<TitleTaken>()("TitleTaken", fieldRejection(NoteFields)) {}
export class StoreUnavailable extends Data.TaggedError("StoreUnavailable") {
	readonly isRetryable = true;
}

export class NotesStore extends Context.Service<
	NotesStore,
	{
		readonly find: (id: number) => Effect.Effect<Option.Option<StoredNote>, StoreUnavailable>;
		readonly insert: (title: string, owner: string) => Effect.Effect<StoredNote, StoreUnavailable>;
		readonly owned: (owner: string) => Effect.Effect<readonly StoredNote[], StoreUnavailable>;
	}
>()("@shivaedev/contract/test/ModuleNotesStore") {}

export class Caller extends RpcMiddleware.Service<Caller>()("@shivaedev/contract/test/ModuleCaller") {}

const signedInUser = Effect.flatMap(CurrentViewer, (viewer) =>
	Option.match(viewer, {
		onNone: () => Effect.fail(new Unauthorized({ message: "Sign in first" })),
		onSome: ({ id }) => Effect.succeed(id),
	}),
);

function toNote({ id, title }: StoredNote): typeof Note.Type {
	return { id, title };
}

function toNotes(notes: readonly StoredNote[]): readonly (typeof Note.Type)[] {
	return notes.map(toNote);
}

export const Create = command("create", {
	payload: NoteFields,
	rejections: { TitleTaken, Unauthorized },
	*run({ title }) {
		const store = yield* NotesStore;
		const owner = yield* signedInUser;
		const owned = yield* store.owned(owner);
		if (owned.some((note) => note.title === title)) {
			return yield* new TitleTaken({ field: "title", message: "You already have a note with that title" });
		}
		return toNote(yield* store.insert(title, owner));
	},
	success: Note,
});

export const Get = query("get", {
	payload: { id: Schema.Number },
	readPolicy: ({ id }, viewer) =>
		Effect.gen(function* () {
			if (Option.isNone(viewer)) {
				return false;
			}
			const note = yield* (yield* NotesStore).find(id);
			return Option.exists(note, ({ owner }) => owner === viewer.value.id);
		}),
	reads: ({ id }) => [moduleNotes.item(id)],
	rejections: { NotFound },
	*run({ id }) {
		const note = yield* (yield* NotesStore).find(id);
		if (Option.isNone(note)) {
			return yield* new NotFound({ message: "Note not found" });
		}
		return toNote(note.value);
	},
	success: Note,
});

export const List = query("list", {
	reads: () => [moduleNotes.list],
	rejections: { Unauthorized },
	*run() {
		const store = yield* NotesStore;
		return toNotes(yield* store.owned(yield* signedInUser));
	},
	success: Schema.Array(Note),
});

export const Notes = defineModule({
	middleware: Caller,
	name: "moduleNotes",
	operations: [List, Get, Create],
	requires: [NotesStore],
});
