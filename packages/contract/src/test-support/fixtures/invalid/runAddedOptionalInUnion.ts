import { Schema } from "effect";
import { query } from "#operation.ts";
import { SessionUser } from "#test/runNotes.ts";

interface PinnableNote {
	readonly id: number;
	readonly pinned?: boolean;
	readonly title: string;
}

query("findsPinnable", {
	reads: () => [],
	*run() {
		const { id } = yield* SessionUser;
		const note: PinnableNote | null = id === "" ? null : { id: 1, pinned: true, title: id };
		return note;
	},
	success: Schema.NullOr(Schema.Struct({ id: Schema.Number, title: Schema.String })),
});
