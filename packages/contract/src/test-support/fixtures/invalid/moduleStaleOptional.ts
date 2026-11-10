import { Schema } from "effect";
import { defineModule } from "#defineModule.ts";
import { query } from "#operation.ts";
import { WireNotesStore } from "#test/wireNotes.ts";

interface PinnableNote {
	readonly id: number;
	readonly pinned?: boolean;
	readonly title: string;
}

const Latest = query("latest", {
	reads: () => [],
	*run() {
		const store = yield* WireNotesStore;
		const [note] = yield* store.owned("alice");
		const latest: PinnableNote = { id: note?.id ?? 0, pinned: true, title: note?.title ?? "" };
		return latest;
	},
});

defineModule({
	name: "staleOptional",
	operations: [Latest],
	requires: [WireNotesStore],
	wire: { latest: { rejections: {}, success: Schema.Struct({ id: Schema.Number, title: Schema.String }) } },
});
