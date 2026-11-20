import { Schema } from "effect";
import { defineModule } from "#defineModule.ts";
import { query } from "#operation.ts";
import { SessionUser } from "#test/runNotes.ts";

interface PinnableNote {
	readonly id: number;
	readonly pinned?: boolean;
	readonly title: string;
}

const Operation = query("holdsPinnable", {
	reads: () => [],
	*run() {
		const { id } = yield* SessionUser;
		const held: { note: PinnableNote } = { note: { id: 1, pinned: true, title: id } };
		return held;
	},
});

defineModule({
	name: "holdsPinnable",
	operations: [Operation],
	wire: {
		holdsPinnable: {
			rejections: {},
			success: Schema.Struct({ note: Schema.mutableKey(Schema.Struct({ id: Schema.Number, title: Schema.String })) }),
		},
	},
});
