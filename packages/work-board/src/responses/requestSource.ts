import { authoredQuestion, openItem } from "#attention/inbox.ts";
import { attentionRequests } from "#attention/requests.ts";
import type { MetadataDocument } from "#metadata/model.ts";
import type { Snapshot } from "#search/snapshot.ts";

export function requestSource(
	data: Snapshot,
	item: string,
	request: string,
): { readonly document: MetadataDocument; readonly reason: string } | undefined {
	const matches = data.model.ids.get(item);
	const source = data.unavailable.length === 0 && matches?.length === 1 ? matches[0] : undefined;
	if (source && authoredQuestion(source) && openItem(source) && request === "answer") {
		if (source.parsed.diagnostics.some((diagnostic) => ["options", "recommended", "question"].includes(diagnostic.field ?? ""))) {
			return undefined;
		}
		return { document: source, reason: source.parsed.fields.nextAction ?? "A question needs your answer" };
	}
	const entry = attentionRequests(data).entries.find((candidate) => candidate.itemId === item && candidate.request.id === request);
	return entry ? { document: entry.document, reason: entry.request.reason } : undefined;
}
