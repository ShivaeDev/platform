import { documentSource, type MetadataDocument } from "#server/metadata/model.ts";
import { revisionOf } from "#server/responses/records.ts";
import type { SettledRecord } from "./settledCatalogue.ts";
import { settledRecords } from "./settledRecords.ts";

export function settledPlan(documents: readonly MetadataDocument[], catalogue: readonly SettledRecord[]) {
	const existing = new Map(catalogue.map((record) => [record.id, record]));
	const candidates = new Map(settledRecords(documents).map((candidate) => [candidate.id, candidate]));
	return documents.flatMap((document) => {
		const id = document.parsed.fields.id ?? "";
		const saved = existing.get(id);
		const candidate = candidates.get(id);
		if (!(saved || candidate)) {
			return [];
		}
		const revision = revisionOf(documentSource(document));
		if (saved) {
			return saved.file === document.file && saved.revision === revision ? [{ document, record: saved }] : [];
		}
		const record: SettledRecord = {
			file: document.file,
			id,
			item: candidate?.item ?? id,
			modified: document.modified ?? 0,
			revision,
			targets: document.parsed.fields.relationships?.map((relation) => relation.target.split("#")[0] ?? "") ?? [],
		};
		return [{ document, record }];
	});
}
