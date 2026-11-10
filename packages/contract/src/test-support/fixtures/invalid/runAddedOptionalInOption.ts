import { Option, Schema } from "effect";
import { query } from "#operation.ts";
import { SessionUser } from "#test/runNotes.ts";

interface PinnableNote {
	readonly id: number;
	readonly pinned?: boolean;
	readonly title: string;
}

query("latestPinnable", {
	reads: () => [],
	*run() {
		const { id } = yield* SessionUser;
		const note: Option.Option<PinnableNote> = Option.some({ id: 1, pinned: true, title: id });
		return note;
	},
	success: Schema.Option(Schema.Struct({ id: Schema.Number, title: Schema.String })),
});
