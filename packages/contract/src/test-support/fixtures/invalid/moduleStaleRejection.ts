import { Unauthorized } from "@shivaedev/errors/taxonomy.ts";
import { defineModule } from "#defineModule.ts";
import { Create, List, WireNotesStore } from "#test/wireNotes.ts";
import { wireNotesWire } from "#test/wireNotesClient.ts";
import { WireCaller } from "#test/wireNotesModel.ts";

defineModule({
	middleware: WireCaller,
	name: "staleRejection",
	operations: [List, Create],
	requires: [WireNotesStore],
	wire: { ...wireNotesWire, create: { rejections: { Unauthorized }, success: wireNotesWire.create.success } },
});
