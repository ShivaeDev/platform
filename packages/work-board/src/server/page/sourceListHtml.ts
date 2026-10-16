import { type SourceLink, sourceGroups } from "#browser/document/sourceGroups.ts";
import { escapeHtml } from "#browser/escapeHtml.ts";
import type { MetadataModel } from "#server/metadata/model.ts";

export function sourceTitle(file: string, model: MetadataModel): string {
	return model.documents.find((document) => document.file === file)?.parsed.body.match(/^# (?<title>.+)$/mu)?.groups?.title ?? file;
}

export function sourceListHtml(links: readonly SourceLink[]): string {
	return `<ul>${sourceGroups(links)
		.map((group) => {
			const rows = group.sources
				.map(
					(link) =>
						`<li><a href="${escapeHtml(link.href)}" title="${escapeHtml(link.label)}">${escapeHtml(link.title ?? link.label)}</a>${link.status ? ` · ${escapeHtml(link.status)}` : ""}</li>`,
				)
				.join("");
			return group.sources.length === 1 ? rows : `<li><details><summary>${escapeHtml(group.label)}</summary><ul>${rows}</ul></details></li>`;
		})
		.join("")}</ul>`;
}
