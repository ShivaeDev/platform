import { defineModule } from "#defineModule.ts";
import { query } from "#operation.ts";
import { List, WireNotesStore } from "#test/wireNotes.ts";
import { wireNotesWire } from "#test/wireNotesClient.ts";
import { WireCaller } from "#test/wireNotesModel.ts";

const Count = query("count", {
	reads: () => [],
	*run() {
		const store = yield* WireNotesStore;
		const notes = yield* store.owned("alice");
		return notes.length;
	},
});

defineModule({
	middleware: WireCaller,
	name: "missingFromWire",
	operations: [List, Count],
	requires: [WireNotesStore],
	wire: { list: wireNotesWire.list },
});
