import { Effect, Layer, Option, Ref, Schema } from "effect";
import { storyKit } from "@shivaedev/test-story/server/storyKit.ts";
import { checkQuery } from "#readPolicy.ts";
import { answered } from "#test/answers.ts";
import { Create, Import, List, NoteSource, NotesRepository, SessionUser, type StoredNote } from "#test/runNotes.ts";

const sourceTitles: Readonly<Record<number, string>> = { 1: "Groceries", 2: "reserved" };

export const operationRunStory = storyKit({
	*create() {
		const stored = yield* Ref.make<readonly StoredNote[]>([]);
		const repository = NotesRepository.of({
			findMany: (userId) => Ref.get(stored).pipe(Effect.map((notes) => notes.filter((note) => note.userId === userId))),
			findOne: (id, userId) =>
				Ref.get(stored).pipe(Effect.map((notes) => Option.fromNullishOr(notes.find((note) => note.id === id && note.userId === userId)))),
			insert: (title, userId) =>
				Ref.modify(stored, (notes) => {
					const note = { id: notes.length + 1, title, userId };
					return [note, [...notes, note]];
				}),
		});
		const services = Layer.mergeAll(
			Layer.succeed(NotesRepository, repository),
			Layer.succeed(SessionUser, { id: "alice" }),
			Layer.succeed(NoteSource, { title: (id: number) => Effect.succeed(sourceTitles[id] ?? "Untitled") }),
		);
		return { services, stored };
	},
	name: "operations written as payload and run",
	stages: [],
	verbs: ({ services, stored }, story) => ({
		announcedKeys: (operation: "create" | "import") => {
			story.tell(`the ${operation} command announces its keys after a successful call`);
			const keys = (operation === "create" ? Create : Import).invalidates({ id: 1, title: "Groceries" }, { id: 1, title: "Groceries" });
			return Effect.succeed(
				keys.length === 0 ? "no keys" : keys.map((key) => (key._tag === "List" ? `the ${key.collection} list` : key._tag)).join(", "),
			);
		},
		answers: (tag: "InternalServerError" | "ServiceUnavailable") => {
			story.tell(`the create command's rejection schema decodes a ${tag} answer`);
			return answered(Schema.decodeUnknownEffect(Create.error)({ _tag: tag, message: "Try again later" }), (decoded) => `decoded ${decoded._tag}`);
		},
		importNote: (id: number) => {
			story.tell(`alice imports source note ${id}`);
			return answered(Import.run({ id }).pipe(Effect.provide(services)), (note) => `imported ${note.title}`);
		},
		readList: (viewer: "anonymous" | "alice") => {
			story.tell(`${viewer === "alice" ? "alice" : "an anonymous viewer"} asks to read the list`);
			const asked = viewer === "alice" ? Option.some({ id: "alice" }) : Option.none();
			return answered(checkQuery(List, undefined, asked), () => "allowed");
		},
		storedTitles: () => Ref.get(stored).pipe(Effect.map((notes) => notes.map(({ title, userId }) => `${userId}: ${title}`))),
	}),
});
