import { Schema } from "effect";
import { defineModule } from "#defineModule.ts";
import { query } from "#operation.ts";
import { SessionUser } from "#test/runNotes.ts";

interface PinnableNote {
	readonly id: number;
	readonly pinned?: boolean;
	readonly title: string;
}

const Operation = query("listsPinnable", {
	reads: () => [],
	*run() {
		const { id } = yield* SessionUser;
		const notes: readonly PinnableNote[] = [{ id: 1, pinned: true, title: id }];
		return notes;
	},
});

defineModule({
	name: "listsPinnable",
	operations: [Operation],
	wire: { listsPinnable: { rejections: {}, success: Schema.Array(Schema.Struct({ id: Schema.Number, title: Schema.String })) } },
});
