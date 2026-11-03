import type { ParsedMetadata } from "@shivaedev/work-board/integration/metadata.ts";

export function fleetApproved(parsed: ParsedMetadata): boolean {
	return parsed.fields.fleet === "approved";
}

export function fleetLaunch(parsed: ParsedMetadata): unknown {
	return parsed.values?.["fleet-launch"];
}

export function fleetDeliverable(parsed: ParsedMetadata): unknown {
	return parsed.fields.delivers === "pr" ? undefined : parsed.fields.delivers;
}

export function fleetPriority(parsed: ParsedMetadata): unknown {
	return parsed.values?.["fleet-priority"];
}

export function fleetPullRequest(parsed: ParsedMetadata): unknown {
	return parsed.values?.pr;
}

export function fleetBranch(parsed: ParsedMetadata): unknown {
	return parsed.values?.branch;
}
