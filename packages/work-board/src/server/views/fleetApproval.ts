import type { ParsedMetadata } from "#integration/metadata.ts";

export function fleetApproval(parsed: ParsedMetadata): boolean {
	return parsed.fields.fleet === "approved";
}
