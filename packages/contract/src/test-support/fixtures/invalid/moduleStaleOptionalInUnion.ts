import { Schema } from "effect";
import { defineModule } from "#defineModule.ts";
import { query } from "#operation.ts";
import { SessionUser } from "#test/runNotes.ts";

interface PinnableNote {
	readonly id: number;
	readonly pinned?: boolean;
	readonly title: string;
}

const Operation = query("findsPinnable", {
	reads: () => [],
	*run() {
		const { id } = yield* SessionUser;
		const note: PinnableNote | null = id === "" ? null : { id: 1, pinned: true, title: id };
		return note;
	},
});

defineModule({
	name: "findsPinnable",
	operations: [Operation],
	wire: { findsPinnable: { rejections: {}, success: Schema.NullOr(Schema.Struct({ id: Schema.Number, title: Schema.String })) } },
});
