import { Effect } from "effect";
import type { MetadataDocument } from "#server/metadata/model.ts";
import { metadataModel } from "#server/metadata/model.ts";
import { metadataParse } from "#server/metadata/parse.ts";
import { entriesOf } from "#server/search/entries.ts";
import { metadataEntries } from "#server/search/metadataEntries.ts";
import type { Snapshot } from "#server/search/snapshot.ts";

export const fixtureSnapshot = Effect.fn("Test.fixtureSnapshot")(function* (files: Readonly<Record<string, string>>, home: string | undefined) {
	const documents: Array<MetadataDocument & { links: string[] }> = Object.entries(files).map(([file, source]) => ({
		file,
		links: [],
		parsed: metadataParse(source),
	}));
	const entries = yield* Effect.promise(() =>
		Promise.all(
			documents.map(async (document) => {
				const links = new Set<string>();
				const { file, parsed } = document;
				const sourceEntries = await entriesOf(parsed.body, file, file === home, parsed.bodyLine, links);
				document.links.push(...links);
				return sourceEntries;
			}),
		),
	);
	const model = metadataModel(documents, [], home);
	return {
		documents,
		entries: metadataEntries(entries.flat(), documents, model),
		model,
		modified: new Map(),
		revision: 0,
		unavailable: [],
	} satisfies Snapshot;
});
