import { Effect, Option, Schema } from "effect";
import { command, query } from "@shivaedev/contract/operation.ts";
import { CurrentViewer } from "@shivaedev/contract/readPolicy.ts";
import { BadRequest, Conflict, NotFound, Unauthorized } from "@shivaedev/errors/taxonomy.ts";
import { Note, NoteFields, type NoteRow } from "#test/notes/model.ts";
import { NotesRepository } from "#test/notes/Repository.ts";

export const NoteId = Schema.Struct({ id: Schema.Number });
export const NoteRename = Schema.Struct({ id: Schema.Number, title: Schema.String });
export const NotesOf = Schema.Struct({ owner: Schema.String });

const signedInOwner = Effect.flatMap(CurrentViewer, (viewer) =>
	Option.match(viewer, {
		onNone: () => Effect.fail(new Unauthorized({ message: "Sign in first" })),
		onSome: ({ id }) => Effect.succeed(id),
	}),
);

function blankTitle() {
	return new BadRequest({ field: "title", message: "Enter a title" });
}

function missing() {
	return new NotFound({ message: "Note not found" });
}

function toNote({ id, owner, title }: NoteRow): Note {
	return new Note({ id, owner, title });
}

function toNotes(rows: readonly NoteRow[]): readonly Note[] {
	return rows.map(toNote);
}

const stored = Effect.fnUntraced(function* (id: number) {
	const repository = yield* NotesRepository;
	return yield* Effect.orDie(repository.findOne({ where: { id } }));
});

export const List = query("list", {
	payload: NotesOf,
	readPolicy: ({ owner }, viewer) => Effect.succeed(Option.exists(viewer, ({ id }) => id === owner)),
	*run({ owner }) {
		const repository = yield* NotesRepository;
		return toNotes(yield* Effect.orDie(repository.findMany({ orderBy: { direction: "asc", field: "id" }, where: { owner } })));
	},
	success: Schema.Array(Note),
});

export const Get = query("get", {
	payload: NoteId,
	readPolicy: ({ id }, viewer) =>
		Effect.map(
			stored(id),
			(row) => Option.isSome(viewer) && Option.match(row, { onNone: () => true, onSome: ({ owner }) => owner === viewer.value.id }),
		),
	rejections: { NotFound },
	*run({ id }) {
		const row = yield* stored(id);
		if (Option.isNone(row)) {
			return yield* missing();
		}
		return toNote(row.value);
	},
	success: Note,
});

export const Create = command("create", {
	payload: NoteFields,
	rejections: { BadRequest, Conflict, Unauthorized },
	*run({ title }) {
		const owner = yield* signedInOwner;
		if (title.trim() === "") {
			return yield* blankTitle();
		}
		const repository = yield* NotesRepository;
		const taken = yield* Effect.orDie(repository.findMany({ where: { owner, title } }));
		if (taken.length > 0) {
			return yield* new Conflict({ field: "title", message: "You already have a note with that title" });
		}
		return toNote(yield* Effect.orDie(repository.insert({ owner, title })));
	},
	success: Note,
});

export const Rename = command("rename", {
	payload: NoteRename,
	rejections: { BadRequest, NotFound },
	*run({ id, title }) {
		if (title.trim() === "") {
			return yield* blankTitle();
		}
		const viewer = yield* CurrentViewer;
		const row = yield* stored(id);
		if (Option.isNone(row) || !Option.exists(viewer, (current) => current.id === row.value.owner)) {
			return yield* missing();
		}
		const repository = yield* NotesRepository;
		return toNote(yield* Effect.orDie(repository.update({ ...row.value, title })));
	},
	success: Note,
});
