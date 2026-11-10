// Stands in for the file `pnpm generate` writes for wireNotes.ts: the module's wire and the browser's contract.
import { Schema } from "effect";
import { Unauthorized } from "@shivaedev/errors/taxonomy.ts";
import { clientContract } from "#clientContract.ts";
import type { ClientMatchesModule } from "#clientMatchesModule.ts";
import type { WireNotes as WireNotesModule } from "#test/wireNotes.ts";
import { NoteFields, TitleTaken, WireCaller, wireNotes } from "#test/wireNotesModel.ts";

const Note = Schema.Struct({ createdAt: Schema.Date, id: Schema.Number, title: Schema.String });

export const wireNotesWire = {
	create: { rejections: { TitleTaken, Unauthorized }, success: Note },
	list: { rejections: { Unauthorized }, success: Schema.Array(Note) },
} as const;

export const WireNotes = clientContract({
	commands: { create: { invalidates: () => [wireNotes.list] } },
	middleware: WireCaller,
	name: "wireNotes",
	payloads: { create: NoteFields },
	queries: { list: { reads: () => [wireNotes.list] } },
	wire: wireNotesWire,
});

export const wireNotesMatchModule: ClientMatchesModule<typeof WireNotes, typeof WireNotesModule> = true;
