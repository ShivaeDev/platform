import { basename } from "node:path";
import { responses } from "@shivaedev/work-board/server/integration/responses.ts";
import type { ReportFile, UnavailableAttachment } from "#reportAttachments.ts";

const { revisionOf } = responses;

export function reportFileName(path: string) {
	return `${revisionOf(path)}-${basename(path)}${path.endsWith(".md") ? ".attachment" : ""}`;
}

export function reportLinks(itemId: string, files: readonly ReportFile[], unavailable: readonly UnavailableAttachment[] = []) {
	const links = files.map(
		(file) => `- [${file.path.replaceAll(/[[\]\\\r\n]/gu, "\\$&")}](${itemId}.attachments/${encodeURIComponent(reportFileName(file.path))})`,
	);
	const warnings = unavailable.map(({ path, reason }) => `- ${escapeText(path)}: ${escapeText(reason)}`);
	return (
		(links.length === 0 ? "" : `\n\n## Attachments\n\n${links.join("\n")}`)
		+ (warnings.length === 0 ? "" : `\n\n## Unavailable attachments\n\n${warnings.join("\n")}`)
	);
}

function escapeText(text: string) {
	return text.replaceAll(/[[\]\\`*_<>\r\n]/gu, (character) => (character === "\n" || character === "\r" ? " " : `\\${character}`));
}
