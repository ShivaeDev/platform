import { parse } from "yaml";
import type { ParsedMetadata } from "@shivaedev/work-board/server/integration/board.ts";

const APPROVAL = "fleet";
const LAUNCH = "fleet-launch";
const DELIVERABLE = "fleet-deliverable";
const PRIORITY = "fleet-priority";
const parsedFields = new WeakMap<ParsedMetadata, ReadonlyMap<string, unknown>>();

function fleetField(parsed: ParsedMetadata, field: string): unknown {
	if (parsed.raw === undefined || parsed.lines[field] === undefined || parsed.diagnostics.some((diagnostic) => diagnostic.field === undefined)) {
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

export function fleetDeliverable(parsed: ParsedMetadata): unknown {
	return fleetField(parsed, DELIVERABLE);
}

export function fleetPriority(parsed: ParsedMetadata): unknown {
	return fleetField(parsed, PRIORITY);
}
