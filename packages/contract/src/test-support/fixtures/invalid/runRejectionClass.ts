import { Schema } from "effect";
import { command } from "#operation.ts";
import { NoteFields, SessionUser, TitleTaken as SharedTitleTaken } from "#test/runNotes.ts";

class TitleTaken extends Schema.TaggedError<TitleTaken>()("TitleTaken", { message: Schema.String }) {}

command("raisesOtherTitleTaken", {
	payload: NoteFields,
	rejections: { TitleTaken },
	*run({ title }) {
		const user = yield* SessionUser;
		if (title === "reserved") {
			return yield* new SharedTitleTaken({ field: "title", message: "That title is reserved" });
		}
		return `${user.id}: ${title}`;
	},
});
