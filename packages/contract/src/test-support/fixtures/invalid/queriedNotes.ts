import { clientContract } from "#clientContract.ts";
import type { ClientMatchesModule } from "#clientMatchesModule.ts";
import type { WireNotes } from "#test/wireNotes.ts";
import { wireNotesWire } from "#test/wireNotesClient.ts";
import { NoteFields, WireCaller } from "#test/wireNotesModel.ts";

const QueriedNotes = clientContract({
	middleware: WireCaller,
	name: "wireNotes",
	payloads: { create: NoteFields },
	queries: ["create", "list"],
	wire: wireNotesWire,
});

export const queriedNotesMatchModule: ClientMatchesModule<typeof QueriedNotes, typeof WireNotes> = true;
