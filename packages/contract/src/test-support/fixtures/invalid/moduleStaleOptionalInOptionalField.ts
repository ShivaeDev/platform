import { Schema } from "effect";
import { defineModule } from "#defineModule.ts";
import { query } from "#operation.ts";
import { SessionUser } from "#test/runNotes.ts";

interface PinnableNote {
	readonly id: number;
	readonly pinned?: boolean;
	readonly title: string;
}

const Operation = query("featuresPinnable", {
	reads: () => [],
	*run() {
		const { id } = yield* SessionUser;
		const featured: { readonly note?: PinnableNote } = { note: { id: 1, pinned: true, title: id } };
		return featured;
	},
});

defineModule({
	name: "featuresPinnable",
	operations: [Operation],
	wire: {
		featuresPinnable: {
			rejections: {},
			success: Schema.Struct({ note: Schema.optionalKey(Schema.Struct({ id: Schema.Number, title: Schema.String })) }),
		},
	},
});
