import { parseDocument } from "yaml";
import type { ParsedMetadata } from "#integration/metadata.ts";

export function fleetApproval(parsed: ParsedMetadata): boolean {
	if (!(parsed.raw && parsed.lines.fleet !== undefined)) {
		return false;
	}
	const lines = parsed.raw.split(/\r?\n/u);
	const closing = lines.findLastIndex((line) => line.trimEnd() === "---");
	const document = parseDocument(lines.slice(1, closing).join("\n"));
	return document.errors.length === 0 && document.warnings.length === 0 && document.get("fleet") === "approved";
}
