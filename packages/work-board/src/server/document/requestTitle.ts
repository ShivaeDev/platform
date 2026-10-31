import type { MetadataDocument, MetadataModel } from "#integration/metadata.ts";
import type { Snapshot } from "#server/search/snapshot.ts";

type TitleOf = (file: string) => string | undefined;

export function requestTitle(document: MetadataDocument, snapshot: Snapshot, request?: string): string {
	const titleOf: TitleOf = (file) => snapshot.entries.find((entry) => entry.kind === "document" && entry.file === file)?.title;
	return readable(titleOf(unblockedFile(document, snapshot.model, request) ?? document.file)) ?? "Requested decision";
}

// A generated decision's own heading names the work only by ID, so its title names the work it unblocks.
export function fleetDecisionTitle(document: MetadataDocument, model: MetadataModel, titleOf: TitleOf): string | undefined {
	const fields = document.parsed.fields;
	if (fields.kind !== "question" || !fields.attention?.some((request) => request.managed)) {
		return undefined;
	}
	const file = unblockedFile(document, model);
	const title = file === undefined || file === document.file ? undefined : readable(titleOf(file));
	return title === undefined ? undefined : `Fleet decision: ${title}`;
}

export function unblockedFile(document: MetadataDocument, model: MetadataModel, request?: string): string | undefined {
	const attention = document.parsed.fields.attention?.find((entry) => request === undefined || entry.id === request);
	const target = model.ids.get(attention?.unblocks[0]?.split("#")[0] ?? document.parsed.fields.id ?? "");
	return target?.length === 1 ? target[0]?.file : undefined;
}

function readable(title: string | undefined) {
	return title && !/[a-f\d]{64}/iu.test(title) ? title : undefined;
}
