import { Schema } from "effect";
import { type ClientMatchesModule, clientContract } from "#clientContract.ts";
import type { WireNotes } from "#test/wireNotes.ts";
import { wireNotesWire } from "#test/wireNotesClient.ts";
import { WireCaller, wireNotes } from "#test/wireNotesModel.ts";

const StaleNotes = clientContract({
	commands: { create: { invalidates: () => [wireNotes.list] } },
	middleware: WireCaller,
	name: "wireNotes",
	payloads: { create: { body: Schema.String, title: Schema.String } },
	queries: { list: { reads: () => [wireNotes.list] } },
	wire: wireNotesWire,
});

export const staleNotesMatchModule: ClientMatchesModule<typeof StaleNotes, typeof WireNotes> = true;
