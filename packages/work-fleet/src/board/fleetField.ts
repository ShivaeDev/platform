import { parse } from "yaml";
import type { ParsedMetadata } from "@shivaedev/work-board/server/integration/board.ts";

const LAUNCH = "fleet-launch";
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
	return parsed.fields.fleet === "approved";
}

export function fleetLaunch(parsed: ParsedMetadata): unknown {
	return fleetField(parsed, LAUNCH);
}

export function fleetDeliverable(parsed: ParsedMetadata): unknown {
	return parsed.fields.delivers === "pr" ? undefined : parsed.fields.delivers;
}

export function fleetPriority(parsed: ParsedMetadata): unknown {
	return fleetField(parsed, PRIORITY);
}

export function fleetPullRequest(parsed: ParsedMetadata): unknown {
	return fleetField(parsed, "pr");
}

export function fleetBranch(parsed: ParsedMetadata): unknown {
	return fleetField(parsed, "branch");
}
