import { identityUrl, referenceTarget } from "#metadata/links.ts";
import type { MetadataDocument } from "#metadata/model.ts";
import type { Metadata } from "#metadata/schema.ts";
import type { Snapshot } from "#search/snapshot.ts";

export type Request = NonNullable<Metadata["attention"]>[number];
export interface AttentionEntry {
	readonly document: MetadataDocument;
	readonly href: string;
	readonly itemId: string;
	readonly line: number;
	readonly request: Request;
	readonly title: string;
}
export interface SourceIssue {
	readonly file: string;
	readonly line: number;
	readonly message: string;
}

function requestsFor(document: MetadataDocument, snapshot: Snapshot, title: string): readonly AttentionEntry[] {
	const { fields, lines } = document.parsed;
	const itemId = fields.id;
	if (!itemId || snapshot.unavailable.length > 0 || snapshot.model.ids.get(itemId)?.length !== 1) {
		return [];
	}
	const requests = fields.attention ?? [];
	return requests.flatMap((request, index) => {
		if (
			request.state !== "open"
			|| requests.filter((other) => other.id === request.id).length !== 1
			|| request.unblocks.some((target) => !referenceTarget(target, snapshot.model))
		) {
			return [];
		}
		return [
			{
				document,
				href: `${identityUrl(itemId)}#attention-request-${encodeURIComponent(request.id)}`,
				itemId,
				line: lines[`attention.${index}`] ?? lines.attention ?? 2,
				request,
				title,
			},
		];
	});
}

export function attentionRequests(snapshot: Snapshot) {
	const titles = new Map(snapshot.entries.filter((entry) => entry.kind === "document").map((entry) => [entry.file, entry.title]));
	const issues: SourceIssue[] = snapshot.documents.flatMap((source) =>
		(snapshot.model.diagnostics.get(source.file) ?? source.parsed.diagnostics).map((problem) => ({ ...problem, file: source.file })),
	);
	const entries = snapshot.documents.flatMap((source) => requestsFor(source, snapshot, titles.get(source.file) ?? source.file));
	const collator = new Intl.Collator("en", { numeric: true, sensitivity: "base" });
	entries.sort((a, b) => collator.compare(a.title, b.title) || a.itemId.localeCompare(b.itemId) || a.request.id.localeCompare(b.request.id));
	return { complete: snapshot.unavailable.length === 0, entries, issues };
}

export function attentionSource(document: MetadataDocument, index: number): string {
	const requests = document.parsed.fields.attention ?? [];
	const id = requests[index]?.id;
	return id && requests.filter((request) => request.id === id).length === 1 ? `attention-request-${id}` : `attention-record-${index}`;
}
