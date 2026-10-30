import type { ParsedMetadata } from "@shivaedev/work-board/integration/metadata.ts";
import { responses } from "@shivaedev/work-board/server/integration/responses.ts";
import { fleetDeliverable } from "#board/fleetField.ts";

const { revisionOf } = responses;

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
