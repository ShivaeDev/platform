import { specificSources } from "#browser/document/sourceGroups.ts";
import { fileUrl } from "#files/url.ts";
import { managedRequestReceipt } from "#server/attention/managedRequestReceipt.ts";
import { backlinksOf } from "#server/metadata/backlinks.ts";
import { referenceTarget } from "#server/metadata/links.ts";
import type { MetadataDocument, MetadataModel } from "#server/metadata/model.ts";
import { relationshipLabel } from "#server/metadata/relationshipLabel.ts";
import { sourceFile, sourceHref } from "#server/metadata/sourceLinks.ts";

export function readingContext(document: MetadataDocument, model: MetadataModel, board: boolean, titles: ReadonlyMap<string, string> = new Map()) {
	const { fields, lines, raw, bodyLine } = document.parsed;
	const sources = new Map(model.documents.map((entry) => [entry.file, entry]));
	const backlinks = [...new Map(backlinksOf(document.file, model).map((link) => [`${link.file}:${link.kind}:${link.line ?? ""}`, link])).values()];
	return {
		backlinks: specificSources(
			backlinks.map((link) => ({
				href: documentReference(link.file, model),
				kind: relationshipLabel(link.kind),
				label: link.file + (link.line === undefined ? "" : `:${link.line}`),
				status: sources.get(link.file)?.parsed.fields.status,
				title: titles.get(link.file) ?? link.file,
			})),
		),
		board,
		claims: criterionClaims(document, model),
		evidenceSources: (fields.evidence ?? []).map((entry) => {
			const href = sourceHref(entry.source, document.file);
			const target = sourceFile(entry.source, document.file, model);
			const missing = target && !model.documents.some((candidate) => candidate.file === target);
			return {
				...(href ? { href } : {}),
				problem: sourceProblem(target, Boolean(missing), model),
			};
		}),
		lines,
		proseLine: bodyLine,
		...(raw === undefined ? {} : { raw }),
		receipts: Object.fromEntries(
			(fields.attention ?? []).flatMap((request) => {
				const receipt = managedRequestReceipt(document, request, model);
				return receipt && referenceTarget(receipt.question, model) ? [[request.id, receipt]] : [];
			}),
		),
	};
}

function sourceProblem(target: string | undefined, missing: boolean, model: MetadataModel): string {
	if (!(missing && target)) {
		return "";
	}
	return model.unavailable.includes(target) ? " (source unavailable)" : " (missing Markdown source)";
}
function criterionClaims(document: MetadataDocument, model: MetadataModel) {
	const claims = model.documents.flatMap((entry) =>
		(entry.parsed.fields.evidence ?? []).map((claim, index) => ({
			criterion: claim.criterion,
			href: documentReference(entry.file, model, `#recorded-evidence-${index}`),
			label: entry.file + (entry.parsed.lines[`evidence.${index}.source`] === undefined ? "" : `:${entry.parsed.lines[`evidence.${index}.source`]}`),
		})),
	);
	return Object.fromEntries(
		(document.parsed.fields.criteria ?? []).map((criterion) => [
			criterion.id,
			claims.filter((claim) => claim.criterion === `${document.parsed.fields.id}#${criterion.id}`).map(({ href, label }) => ({ href, label })),
		]),
	);
}

function documentReference(file: string, model: MetadataModel, hash = ""): string {
	const id = model.documents.find((document) => document.file === file)?.parsed.fields.id;
	return ((id ? referenceTarget(id, model) : undefined) ?? fileUrl(file)) + hash;
}
