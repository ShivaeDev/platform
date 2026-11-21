import { Schema } from "effect";
import { clientContract } from "#clientContract.ts";
import type { ClientMatchesModule } from "#clientMatchesModule.ts";
import type { WireNotes } from "#test/wireNotes.ts";
import { wireNotesWire } from "#test/wireNotesClient.ts";
import { WireCaller } from "#test/wireNotesModel.ts";

const StaleNotes = clientContract({
	commands: ["create"],
	middleware: WireCaller,
	name: "wireNotes",
	payloads: { create: { body: Schema.String, title: Schema.String } },
	queries: ["list"],
	wire: wireNotesWire,
});

export const staleNotesMatchModule: ClientMatchesModule<typeof StaleNotes, typeof WireNotes> = true;
