import { basename } from "node:path";
import { revisionOf } from "@shivaedev/work-board/responses/records.ts";
import type { ReportFile } from "#host/reportDiff.ts";

export function reportFileName(path: string) {
	return `${revisionOf(path)}-${basename(path)}${path.endsWith(".md") ? ".attachment" : ""}`;
}

export function reportLinks(itemId: string, files: readonly ReportFile[]) {
	const links = files.map(
		(file) => `- [${file.path.replaceAll(/[[\]\\\r\n]/gu, "\\$&")}](${itemId}.attachments/${encodeURIComponent(reportFileName(file.path))})`,
	);
	return links.length === 0 ? "" : `\n\n## Attachments\n\n${links.join("\n")}`;
}
