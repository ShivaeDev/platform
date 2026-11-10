import { Schema } from "effect";
import { Unauthorized } from "@shivaedev/errors/taxonomy.ts";
import { defineModule } from "#defineModule.ts";
import { Create, List, WireNotesStore } from "#test/wireNotes.ts";
import { wireNotesWire } from "#test/wireNotesClient.ts";
import { WireCaller } from "#test/wireNotesModel.ts";

const Note = Schema.Struct({ id: Schema.Number, title: Schema.String });

defineModule({
	middleware: WireCaller,
	name: "staleSuccess",
	operations: [List, Create],
	requires: [WireNotesStore],
	wire: { ...wireNotesWire, list: { rejections: { Unauthorized }, success: Schema.Array(Note) } },
});
