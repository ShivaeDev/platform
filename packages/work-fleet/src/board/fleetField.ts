import { parse } from "yaml";
import type { Diagnostic, ParsedMetadata } from "@shivaedev/work-board/metadata/parse.ts";

const APPROVAL = "fleet";
const LAUNCH = "fleet-launch";
const FIELDS: ReadonlySet<string | undefined> = new Set([APPROVAL, LAUNCH]);
const parsedFields = new WeakMap<ParsedMetadata, ReadonlyMap<string, unknown>>();

// Board core reports addon fields as unknown; Fleet owns these and interprets them itself.
export function boardDiagnostics(parsed: ParsedMetadata): readonly Diagnostic[] {
	return parsed.diagnostics.filter((diagnostic) => !FIELDS.has(diagnostic.field));
}

function fleetField(parsed: ParsedMetadata, field: string): unknown {
	if (parsed.raw === undefined || !parsed.diagnostics.some((diagnostic) => diagnostic.field === field)) {
		return undefined;
	}
	const cached = parsedFields.get(parsed);
	if (cached !== undefined) {
		return cached.get(field);
	}
	const lines = parsed.raw.split(/\r?\n/u);
	const closing = lines.findLastIndex((line) => line.trimEnd() === "---");
	const data: unknown = parse(lines.slice(1, closing).join("\n"));
	const values = new Map(typeof data === "object" && data !== null ? Object.entries(data) : []);
	parsedFields.set(parsed, values);
	return values.get(field);
}

export function fleetApproved(parsed: ParsedMetadata): boolean {
	return fleetField(parsed, APPROVAL) === "approved";
}

export function fleetLaunch(parsed: ParsedMetadata): unknown {
	return fleetField(parsed, LAUNCH);
}
