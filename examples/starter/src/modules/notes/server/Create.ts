import { Effect } from "effect";
import { command } from "@shivaedev/contract/operation.ts";
import { SessionUser } from "@shivaedev/identity/identity.ts";
import { rateLimit } from "@shivaedev/rate-limit/rateLimit.ts";
import { transact } from "@shivaedev/sql/transact.ts";
import { NoteFields, toNote } from "#modules/notes/model.ts";
import { enqueueNote } from "#modules/notes/server/enqueue.ts";
import { NotesRepository } from "#modules/notes/server/Repository.ts";

export const Create = command("create", {
	payload: NoteFields,
	*run({ title }) {
		const repository = yield* NotesRepository;
		const { id: userId } = yield* SessionUser;
		yield* rateLimit({ key: `notes.create:${userId}`, per: 10, window: "1 minute" });
		return yield* repository.insert({ title, userId, wordCount: null }).pipe(
			Effect.tap((row) => enqueueNote(row.id)),
			Effect.map(toNote),
			transact(),
		);
	},
});
