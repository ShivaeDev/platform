import { Schema } from "effect";
import { query } from "#operation.ts";
import { SessionUser } from "#test/runNotes.ts";

interface PinnableNote {
	readonly id: number;
	readonly pinned?: boolean;
	readonly title: string;
}

query("featuresPinnable", {
	reads: () => [],
	*run() {
		const { id } = yield* SessionUser;
		const featured: { readonly note?: PinnableNote } = { note: { id: 1, pinned: true, title: id } };
		return featured;
	},
	success: Schema.Struct({ note: Schema.optionalKey(Schema.Struct({ id: Schema.Number, title: Schema.String })) }),
});
