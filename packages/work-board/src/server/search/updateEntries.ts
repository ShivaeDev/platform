import { fleetRecords } from "#server/attention/inbox.ts";
import { fleetDecisionTitle } from "#server/document/requestTitle.ts";
import type { MetadataModel } from "#server/metadata/model.ts";
import type { Entry } from "./entries.ts";
import { metadataEntries } from "./metadataEntries.ts";
import type { IndexedDocument } from "./readDocument.ts";

export function updateEntries() {
	let previous: MetadataModel | undefined;
	let grouped: ReadonlySet<string> = new Set();
	let sources = new Map<string, IndexedDocument>();
	let enriched = new Map<string, readonly Entry[]>();
	let titles = new Map<string, string | undefined>();
	return (records: ReadonlyMap<string, IndexedDocument>, model: MetadataModel): readonly Entry[] => {
		const recordsNow = fleetRecords(model);
		const next = new Map<string, readonly Entry[]>();
		const titlesNow = new Map<string, string | undefined>();
		function titleOf(file: string) {
			return records.get(file)?.entries[0]?.title;
		}
		for (const [file, record] of records) {
			const title = fleetDecisionTitle(record.document, model, titleOf);
			titlesNow.set(file, title);
			const id = record.document.parsed.fields.id;
			const unique = id && model.ids.get(id)?.length === 1;
			const wasUnique = id && previous?.ids.get(id)?.length === 1;
			const complete = model.unavailable.length === 0;
			const wasComplete = previous?.unavailable.length === 0;
			const hit = enriched.get(file);
			next.set(
				file,
				hit
					&& sources.get(file) === record
					&& unique === wasUnique
					&& complete === wasComplete
					&& recordsNow.has(file) === grouped.has(file)
					&& title === titles.get(file)
					? hit
					: metadataEntries(record.entries, [record.document], model, recordsNow, titleOf),
			);
		}
		previous = model;
		grouped = recordsNow;
		sources = new Map(records);
		enriched = next;
		titles = titlesNow;
		return [
			...[...records].flatMap(([file, record]) => next.get(file)?.slice(0, record.entries.length) ?? []),
			...[...records].flatMap(([file, record]) => next.get(file)?.slice(record.entries.length) ?? []),
		];
	};
}
