import { parse } from "yaml";
import type { Diagnostic, ParsedMetadata } from "@shivaedev/work-board/metadata/parse.ts";

const FIELD = "fleet";

// Board core reports addon fields as unknown; Fleet owns this one and interprets it itself.
export function boardDiagnostics(parsed: ParsedMetadata): readonly Diagnostic[] {
	return parsed.diagnostics.filter((diagnostic) => diagnostic.field !== FIELD);
}

export function fleetApproved(parsed: ParsedMetadata): boolean {
	if (parsed.raw === undefined || !parsed.diagnostics.some((diagnostic) => diagnostic.field === FIELD)) {
		return false;
	}
	const lines = parsed.raw.split(/\r?\n/u);
	const closing = lines.findLastIndex((line) => line.trimEnd() === "---");
	const data: unknown = parse(lines.slice(1, closing).join("\n"));
	return typeof data === "object" && data !== null && FIELD in data && data[FIELD] === "approved";
}
