import type { MetadataDocument, MetadataModel } from "./model.ts";
import { referenceFile, sourceFile } from "./sourceLinks.ts";

export interface Backlink {
	readonly file: string;
	readonly kind: string;
	readonly line?: number;
}

function references(document: MetadataDocument, model: MetadataModel) {
	const { fields, lines } = document.parsed;
	return [
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

export function backlinksOf(file: string, model: MetadataModel): readonly Backlink[] {
	return model.documents.flatMap((document) =>
		document.file === file
			? []
			: references(document, model)
					.filter((reference) => reference.target === file)
					.map((reference) => ({ file: document.file, kind: reference.kind, ...(reference.line === undefined ? {} : { line: reference.line }) })),
	);
}
