import type { Document } from "#browser/document/schema.ts";
import type { ResultProjection } from "#browser/views/ResultProjection.ts";
import type { MetadataDocument } from "#integration/metadata.ts";
import { referenceTarget } from "#server/metadata/links.ts";
import type { Snapshot } from "#server/search/snapshot.ts";
export function resultTargets(result: MetadataDocument, data: Snapshot, document: Document): ResultProjection["targets"] {
	const targets = new Set(result.parsed.fields.relationships?.map((entry) => entry.target));
	if (result.parsed.fields.id) {
		targets.add(result.parsed.fields.id);
	}
	function link(label: string, target: string) {
		return { href: referenceTarget(target, data.model), label };
	}
	function criterionRow(id: string, entry: { readonly id: string; readonly text: string }) {
		const reference = `${id}#${entry.id}`;
		const claims = referenceTarget(reference, data.model)
			? (result.parsed.fields.evidence ?? []).flatMap((claim, index) => {
					if (claim.criterion !== reference) {
						return [];
					}
					const resolved = document.reading?.evidenceSources[index];
					return [{ ...claim, problem: resolved?.problem ?? "", source: { href: resolved?.href, label: claim.source } }];
				})
			: [];
		return { claims, link: link(entry.text, reference), text: entry.text };
	}
	return [...targets].map((target) => {
		const [id = "", criterion] = target.split("#");
		const source = data.model.ids.get(id)?.[0];
		const available = Boolean(source && referenceTarget(target, data.model));
		const entries = available ? (source?.parsed.fields.criteria ?? []).filter((entry) => !criterion || entry.id === criterion) : [];
		return { available, criteria: entries.map((entry) => criterionRow(id, entry)), link: link(target, target), status: source?.parsed.fields.status };
	});
}
