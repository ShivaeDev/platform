import type { ParsedMetadata } from "@shivaedev/work-board/metadata/parse.ts";
import { revisionOf } from "@shivaedev/work-board/responses/records.ts";
import { fleetDeliverable } from "#board/fleetField.ts";

export function briefRevision(parsed: ParsedMetadata): string {
	return revisionOf(
		JSON.stringify({
			body: parsed.body,
			criteria: (parsed.fields.criteria ?? []).map(({ id, text }) => ({ id, text })),
			deliverable: fleetDeliverable(parsed) ?? "change",
			kind: parsed.fields.kind,
			relationships: (parsed.fields.relationships ?? []).map(({ kind, target }) => ({ kind, target })),
		}),
	);
}
