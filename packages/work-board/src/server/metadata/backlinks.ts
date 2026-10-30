import type { MetadataDocument, MetadataModel } from "#integration/metadata.ts";
import { referenceFile, sourceFile } from "./sourceLinks.ts";

export interface Backlink {
	readonly file: string;
	readonly kind: string;
	readonly line?: number;
}

export function referencesFrom(document: MetadataDocument, model: MetadataModel) {
	const { fields, lines } = document.parsed;
	return [
		...(fields.handoff ? [{ kind: "agent handoff", line: lines.handoff, target: referenceFile(fields.handoff.item, model) }] : []),
		...(fields.question ? [{ kind: "reviewed question", line: lines.question, target: referenceFile(fields.question.item, model) }] : []),
		...(fields.response ? [{ kind: "recorded response", line: lines.response, target: referenceFile(fields.response.question, model) }] : []),
		...(fields.response?.supersedes
			? [{ kind: "superseding response", line: lines.response, target: referenceFile(fields.response.supersedes, model) }]
			: []),
		...(fields.attention?.flatMap((request, index) =>
			request.unblocks.map((target, targetIndex) => ({
				kind: "attention target",
				line: lines[`attention.${index}.unblocks.${targetIndex}`],
				target: referenceFile(target, model),
			})),
		) ?? []),
		...(fields.relationships?.map((link, index) => ({
			kind: link.kind,
			line: lines[`relationships.${index}.target`],
			target: referenceFile(link.target, model),
		})) ?? []),
		...(fields.items?.map((item, index) => ({ kind: "board member", line: lines[`items.${index}`], target: referenceFile(item, model) })) ?? []),
		...(fields.evidence?.flatMap((evidence, index) => [
			{ kind: "evidence source", line: lines[`evidence.${index}.source`], target: sourceFile(evidence.source, document.file, model) },
			{
				kind: "criterion evidence",
				line: lines[`evidence.${index}.criterion`],
				target: evidence.criterion ? referenceFile(evidence.criterion, model) : undefined,
			},
		]) ?? []),
		...(document.links?.map((link) => ({ kind: "Markdown link", line: undefined, target: sourceFile(link, document.file, model) })) ?? []),
	];
}

const backlinks = new WeakMap<MetadataModel, ReadonlyMap<string, readonly Backlink[]>>();

function indexBacklinks(model: MetadataModel) {
	const next = new Map<string, Backlink[]>();
	for (const document of model.documents) {
		for (const reference of referencesFrom(document, model)) {
			if (!reference.target || reference.target === document.file) {
				continue;
			}
			const matches = next.get(reference.target) ?? [];
			matches.push({ file: document.file, kind: reference.kind, ...(reference.line === undefined ? {} : { line: reference.line }) });
			next.set(reference.target, matches);
		}
	}
	return next;
}

export function backlinksOf(file: string, model: MetadataModel): readonly Backlink[] {
	let indexed = backlinks.get(model);
	if (!indexed) {
		indexed = indexBacklinks(model);
		backlinks.set(model, indexed);
	}
	return indexed.get(file) ?? [];
}
