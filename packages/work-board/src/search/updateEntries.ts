import type { MetadataModel } from "#metadata/model.ts";
import type { Entry } from "./entries.ts";
import { metadataEntries } from "./metadataEntries.ts";
import type { IndexedDocument } from "./readDocument.ts";

export function updateEntries() {
	let previous: MetadataModel | undefined;
	let sources = new Map<string, IndexedDocument>();
	let enriched = new Map<string, readonly Entry[]>();
	return (records: ReadonlyMap<string, IndexedDocument>, model: MetadataModel): readonly Entry[] => {
		const next = new Map<string, readonly Entry[]>();
		for (const [file, record] of records) {
			const id = record.document.parsed.fields.id;
			const unique = id && model.ids.get(id)?.length === 1;
			const wasUnique = id && previous?.ids.get(id)?.length === 1;
			const complete = model.unavailable.length === 0;
			const wasComplete = previous?.unavailable.length === 0;
			const hit = enriched.get(file);
			next.set(
				file,
				hit && sources.get(file) === record && unique === wasUnique && complete === wasComplete
					? hit
					: metadataEntries(record.entries, [record.document], model),
			);
		}
		previous = model;
		sources = new Map(records);
		enriched = next;
		return [
			...[...records].flatMap(([file, record]) => next.get(file)?.slice(0, record.entries.length) ?? []),
			...[...records].flatMap(([file, record]) => next.get(file)?.slice(record.entries.length) ?? []),
		];
	};
}
