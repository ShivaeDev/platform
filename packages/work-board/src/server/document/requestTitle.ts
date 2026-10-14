import type { MetadataDocument } from "#server/metadata/model.ts";
import type { Snapshot } from "#server/search/snapshot.ts";

export function requestTitle(document: MetadataDocument, snapshot: Snapshot, request?: string): string {
	const attention = document.parsed.fields.attention?.find((entry) => request === undefined || entry.id === request);
	const target = snapshot.model.ids.get(attention?.unblocks[0]?.split("#")[0] ?? document.parsed.fields.id ?? "");
	const file = target?.length === 1 ? target[0]?.file : document.file;
	const title = snapshot.entries.find((entry) => entry.kind === "document" && entry.file === file)?.title;
	return title && !/[a-f\d]{64}/iu.test(title) ? title : "Requested decision";
}
