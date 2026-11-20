import { Context, Data, Effect, Option, Schema } from "effect";
import { RpcMiddleware } from "effect/rpc";
import { collection } from "@shivaedev/changes/keys.ts";
import { NotFound, Unauthorized } from "@shivaedev/errors/taxonomy.ts";
import { commandResult } from "#commandResult.ts";
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
	*run({ title }) {
		const store = yield* NotesStore;
		const owner = yield* signedInUser;
		const owned = yield* store.owned(owner);
		if (owned.some((note) => note.title === title)) {
			return yield* new TitleTaken({ field: "title", message: "You already have a note with that title" });
		}
		return toNote(yield* store.insert(title, owner));
	},
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
	*run({ id }) {
		const note = yield* (yield* NotesStore).find(id);
		if (Option.isNone(note)) {
			return yield* new NotFound({ message: "Note not found" });
		}
		return toNote(note.value);
	},
});

export const List = query("list", {
	reads: () => [moduleNotes.list],
	*run() {
		const store = yield* NotesStore;
		return toNotes(yield* store.owned(yield* signedInUser));
	},
});

// The note is found by its title, so only run knows which note's key to announce.
export const Touch = command("touch", {
	payload: NoteFields,
	*run({ title }) {
		const store = yield* NotesStore;
		const note = (yield* store.owned(yield* signedInUser)).find((owned) => owned.title === title);
		if (note === undefined) {
			return yield* new NotFound({ message: "Note not found" });
		}
		return yield* commandResult({ invalidates: [moduleNotes.item(note.id)], result: toNote(note) });
	},
});

export const Notes = defineModule({
	middleware: Caller,
	name: "moduleNotes",
	operations: [List, Get, Create, Touch],
	requires: [NotesStore],
	wire: {
		create: { rejections: { TitleTaken, Unauthorized }, success: Note },
		get: { rejections: { NotFound }, success: Note },
		list: { rejections: { Unauthorized }, success: Schema.Array(Note) },
		touch: { rejections: { NotFound, Unauthorized }, success: Note },
	},
});
