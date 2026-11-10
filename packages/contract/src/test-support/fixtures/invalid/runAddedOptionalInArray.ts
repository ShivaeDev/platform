import { Schema } from "effect";
import { query } from "#operation.ts";
import { SessionUser } from "#test/runNotes.ts";

interface PinnableNote {
	readonly id: number;
	readonly pinned?: boolean;
	readonly title: string;
}

query("listsPinnable", {
	reads: () => [],
	*run() {
		const { id } = yield* SessionUser;
		const notes: readonly PinnableNote[] = [{ id: 1, pinned: true, title: id }];
		return notes;
	},
	success: Schema.Array(Schema.Struct({ id: Schema.Number, title: Schema.String })),
});
