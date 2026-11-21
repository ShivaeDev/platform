import { clientContract } from "#clientContract.ts";
import type { ClientMatchesModule } from "#clientMatchesModule.ts";
import type { WireNotes } from "#test/wireNotes.ts";
import { wireNotesWire } from "#test/wireNotesClient.ts";
import { WireCaller } from "#test/wireNotesModel.ts";

const ListOnlyNotes = clientContract({
	middleware: WireCaller,
	name: "wireNotes",
	queries: ["list"],
	wire: wireNotesWire,
});

export const listOnlyNotesMatchModule: ClientMatchesModule<typeof ListOnlyNotes, typeof WireNotes> = true;
