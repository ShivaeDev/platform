import { Context, Effect, Option, Schema } from "effect";
import type { SqlError } from "effect/sql/SqlError";
import { collection } from "@shivaedev/changes/keys.ts";
import { NotFound } from "@shivaedev/errors/taxonomy.ts";
import { command, query } from "#operation.ts";
import { fieldRejection } from "#rejection.ts";

export const NoteFields = Schema.Struct({ title: Schema.Trim.check(Schema.isNonEmpty({ message: "Enter a title" })) });
export const NoteId = Schema.Struct({ id: Schema.Number });

export interface StoredNote {
	readonly id: number;
	readonly title: string;
	readonly userId: string;
}

export interface Note {
	readonly id: number;
	readonly title: string;
}

export class NotesRepository extends Context.Service<
	NotesRepository,
	{
		readonly findMany: (userId: string) => Effect.Effect<readonly Note[], SqlError>;
		readonly findOne: (id: number, userId: string) => Effect.Effect<Option.Option<StoredNote>, SqlError>;
		readonly insert: (title: string, userId: string) => Effect.Effect<StoredNote, SqlError>;
	}
>()("@shivaedev/contract/test/NotesRepository") {}
export class SessionUser extends Context.Service<SessionUser, { readonly id: string }>()("@shivaedev/contract/test/SessionUser") {}
export class NoteSource extends Context.Service<NoteSource, { readonly title: (id: number) => Effect.Effect<string> }>()(
	"@shivaedev/contract/test/NoteSource",
) {}
export class TitleTaken extends Schema.TaggedError<TitleTaken>()("TitleTaken", fieldRejection(NoteFields)) {}

export const runNotes = collection("runNotes", Schema.Number);

function toNote({ id, title }: StoredNote): Note {
	return { id, title };
}

const ownedNote = Effect.fnUntraced(function* (id: number) {
	const repository = yield* NotesRepository;
	const { id: userId } = yield* SessionUser;
	const row = yield* repository.findOne(id, userId);
	return yield* Option.match(row, {
		onNone: () => Effect.fail(new NotFound({ message: "Note not found" })),
		onSome: Effect.succeed,
	});
});

export const Create = command("create", {
	invalidates: () => [runNotes.list],
	payload: NoteFields,
	*run({ title }) {
		const repository = yield* NotesRepository;
		const { id: userId } = yield* SessionUser;
		if (title === "reserved") {
			return yield* new TitleTaken({ field: "title", message: "That title is reserved" });
		}
		return yield* repository.insert(title, userId).pipe(Effect.map(toNote));
	},
});

export const Import = command("import", {
	payload: NoteId,
	*run({ id }) {
		const source = yield* NoteSource;
		const title = yield* source.title(id);
		return yield* Create.run({ title });
	},
});

export const Get = query("get", {
	payload: NoteId,
	readPolicy: ({ id }, viewer) =>
		Effect.gen(function* () {
			if (Option.isNone(viewer)) {
				return false;
			}
			const repository = yield* NotesRepository;
			const owned = yield* repository.findOne(id, viewer.value.id);
			return Option.isSome(owned) ? true : yield* new NotFound({ message: "Note not found" });
		}),
	reads: ({ id }) => [runNotes.item(id)],
	*run({ id }) {
		return toNote(yield* ownedNote(id));
	},
});

export const List = query("list", {
	reads: () => [runNotes.list],
	*run() {
		const repository = yield* NotesRepository;
		const { id: userId } = yield* SessionUser;
		return yield* repository.findMany(userId);
	},
});
