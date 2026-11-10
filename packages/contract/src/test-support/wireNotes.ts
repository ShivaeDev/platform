import { Context, Effect, Option } from "effect";
import { Unauthorized } from "@shivaedev/errors/taxonomy.ts";
import { defineModule } from "#defineModule.ts";
import { command, query } from "#operation.ts";
import { CurrentViewer } from "#readPolicy.ts";
import { wireNotesWire } from "#test/wireNotesClient.ts";
import { NoteFields, TitleTaken, WireCaller, wireNotes } from "#test/wireNotesModel.ts";

export interface StoredNote {
	readonly createdAt: Date;
	readonly id: number;
	readonly owner: string;
	readonly title: string;
}

interface Note {
	readonly createdAt: Date;
	readonly id: number;
	readonly title: string;
}

export class WireNotesStore extends Context.Service<
	WireNotesStore,
	{
		readonly insert: (title: string, owner: string) => Effect.Effect<StoredNote>;
		readonly owned: (owner: string) => Effect.Effect<readonly StoredNote[]>;
	}
>()("@shivaedev/contract/test/WireNotesStore") {}

const signedInUser = Effect.flatMap(CurrentViewer, (viewer) =>
	Option.match(viewer, {
		onNone: () => Effect.fail(new Unauthorized({ message: "Sign in first" })),
		onSome: ({ id }) => Effect.succeed(id),
	}),
);

function toNote({ createdAt, id, title }: StoredNote): Note {
	return { createdAt, id, title };
}

function toNotes(notes: readonly StoredNote[]): readonly Note[] {
	return notes.map(toNote);
}

export const Create = command("create", {
	invalidates: () => [wireNotes.list],
	payload: NoteFields,
	*run({ title }) {
		const store = yield* WireNotesStore;
		const owner = yield* signedInUser;
		const owned = yield* store.owned(owner);
		if (owned.some((note) => note.title === title)) {
			return yield* new TitleTaken({ field: "title", message: "You already have a note with that title" });
		}
		return toNote(yield* store.insert(title, owner));
	},
});

export const List = query("list", {
	reads: () => [wireNotes.list],
	*run() {
		const store = yield* WireNotesStore;
		return toNotes(yield* store.owned(yield* signedInUser));
	},
});

export const WireNotes = defineModule({
	middleware: WireCaller,
	name: "wireNotes",
	operations: [List, Create],
	requires: [WireNotesStore],
	wire: wireNotesWire,
});
