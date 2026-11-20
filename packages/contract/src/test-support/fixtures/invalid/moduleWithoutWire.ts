import { defineModule } from "#defineModule.ts";
import { List, WireNotesStore } from "#test/wireNotes.ts";
import { WireCaller } from "#test/wireNotesModel.ts";

defineModule({
	middleware: WireCaller,
	name: "withoutWire",
	operations: [List],
	requires: [WireNotesStore],
});
