import { Option, Schema } from "effect";
import { defineModule } from "#defineModule.ts";
import { query } from "#operation.ts";
import { SessionUser } from "#test/runNotes.ts";

interface PinnableNote {
	readonly id: number;
	readonly pinned?: boolean;
	readonly title: string;
}

const Operation = query("latestPinnable", {
	reads: () => [],
	*run() {
		const { id } = yield* SessionUser;
		const note: Option.Option<PinnableNote> = Option.some({ id: 1, pinned: true, title: id });
		return note;
	},
});

defineModule({
	name: "latestPinnable",
	operations: [Operation],
	wire: { latestPinnable: { rejections: {}, success: Schema.Option(Schema.Struct({ id: Schema.Number, title: Schema.String })) } },
});
