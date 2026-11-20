import { Schema } from "effect";
import { defineModule } from "#defineModule.ts";
import { command } from "#operation.ts";
import { NoteFields, SessionUser, TitleTaken as SharedTitleTaken } from "#test/runNotes.ts";

class TitleTaken extends Schema.TaggedError<TitleTaken>()("TitleTaken", { message: Schema.String }) {}

const Operation = command("raisesOtherTitleTaken", {
	payload: NoteFields,
	*run({ title }) {
		const user = yield* SessionUser;
		if (title === "reserved") {
			return yield* new SharedTitleTaken({ field: "title", message: "That title is reserved" });
		}
		return `${user.id}: ${title}`;
	},
});

defineModule({
	name: "raisesOtherTitleTaken",
	operations: [Operation],
	requires: [SessionUser],
	wire: { raisesOtherTitleTaken: { rejections: { TitleTaken }, success: Schema.String } },
});
