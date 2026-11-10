import { Schema } from "effect";
import { NotFound as SharedNotFound } from "@shivaedev/errors/taxonomy.ts";
import { command } from "#operation.ts";
import { NoteId, SessionUser } from "#test/runNotes.ts";

class NotFound extends Schema.TaggedError<NotFound>()("NotFound", { id: Schema.Number }) {}

command("raisesSharedNotFound", {
	payload: NoteId,
	rejections: { NotFound },
	*run({ id }) {
		const user = yield* SessionUser;
		if (id === 0) {
			return yield* new SharedNotFound({ message: "Note not found" });
		}
		return `${user.id}: ${id}`;
	},
});
