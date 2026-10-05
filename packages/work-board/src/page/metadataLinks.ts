import { fileUrl } from "#files/url.ts";
import { referenceTarget } from "#metadata/links.ts";
import type { MetadataModel } from "#metadata/model.ts";
import { sourceFile, sourceHref } from "#metadata/sourceLinks.ts";
import { escapeHtml } from "./escape.ts";

export function referenceHtml(label: string, target: string, model: MetadataModel): string {
	const href = referenceTarget(target, model);
	return href
		? `<a href="${escapeHtml(href)}">${escapeHtml(label)}</a>`
		: `<span>${escapeHtml(label)} (unresolved, ambiguous, or unavailable)</span>`;
}

export function sourceHtml(source: string, file: string, model: MetadataModel): string {
	const href = sourceHref(source, file);
	if (!href) {
		return escapeHtml(source);
	}
	const target = sourceFile(source, file, model);
	const missing = target && !model.documents.some((document) => document.file === target);
	let problem = "";
	if (missing) {
		problem = model.unavailable.includes(target) ? " (source unavailable)" : " (missing Markdown source)";
	}
	return `<a href="${escapeHtml(href)}" rel="noreferrer">${escapeHtml(source)}</a>${problem}`;
}

export function documentReference(file: string, model: MetadataModel, hash = ""): string {
	const id = model.documents.find((document) => document.file === file)?.parsed.fields.id;
	return ((id ? referenceTarget(id, model) : undefined) ?? fileUrl(file)) + hash;
}

export function valueHtml(text: string | undefined): string {
	return escapeHtml(text ?? "Not recorded");
}
