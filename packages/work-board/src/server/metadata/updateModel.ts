import type { MetadataDocument, MetadataModel } from "#integration/metadata.ts";
import { metadataProblems } from "./problems.ts";
import { referencesOf } from "./referencesOf.ts";

function changedSettledIds(before: ReadonlyMap<string, string> | undefined, after: ReadonlyMap<string, string> | undefined) {
	return [...new Set([...(before?.keys() ?? []), ...(after?.keys() ?? [])])].filter((id) => before?.get(id) !== after?.get(id));
}

export function updateModel(
	previous: MetadataModel | undefined,
	documents: readonly MetadataDocument[],
	unavailable: readonly string[],
	rootFile?: string,
	settled = previous?.settled,
): MetadataModel {
	const groups = new Map<string, MetadataDocument[]>();
	for (const document of documents) {
		const id = document.parsed.fields.id;
		if (id) {
			const matches = groups.get(id) ?? [];
			matches.push(document);
			groups.set(id, matches);
		}
	}
	const ids = new Map<string, readonly MetadataDocument[]>();
	const changed = new Set(changedSettledIds(previous?.settled, settled));
	for (const id of new Set([...groups.keys(), ...(previous?.ids.keys() ?? [])])) {
		const before = previous?.ids.get(id) ?? [];
		const after = groups.get(id);
		const affected = !after || before.length !== after.length || before.some((document, index) => document !== after[index]);
		if (affected) {
			changed.add(id);
		}
		if (after) {
			ids.set(id, affected ? after : before);
		}
	}
	const before = new Map(previous?.documents.map((document) => [document.file, document]));
	const incomplete = unavailable.join("\0") !== previous?.unavailable.join("\0");
	const diagnostics = new Map(
		documents.map((document) => {
			const dependent = referencesOf(document).some((reference) => changed.has(reference.target.split("#")[0] ?? ""));
			const existing = previous?.diagnostics.get(document.file);
			const affected = incomplete || before.get(document.file) !== document || changed.has(document.parsed.fields.id ?? "") || dependent;
			return [document.file, !affected && existing ? existing : metadataProblems(document, ids, unavailable, settled)] as const;
		}),
	);
	return { diagnostics, documents, ids, rootFile, settled, unavailable };
}
