import { Effect } from "effect";
import { metadataModel } from "#server/metadata/model.ts";
import { metadataParse } from "#server/metadata/parse.ts";
import { entriesOf } from "#server/search/entries.ts";
import { metadataEntries } from "#server/search/metadataEntries.ts";
import type { Snapshot } from "#server/search/snapshot.ts";

export const fixtureSnapshot = Effect.fn("Test.fixtureSnapshot")(function* (files: Readonly<Record<string, string>>, home: string | undefined) {
	const documents = Object.entries(files).map(([file, source]) => ({ file, parsed: metadataParse(source) }));
	const model = metadataModel(documents, [], home);
	const entries = yield* Effect.promise(() =>
		Promise.all(documents.map(({ file, parsed }) => entriesOf(parsed.body, file, file === home, parsed.bodyLine))),
	);
	return {
		documents,
		entries: metadataEntries(entries.flat(), documents, model),
		model,
		modified: new Map(),
		revision: 0,
		unavailable: [],
	} satisfies Snapshot;
});
