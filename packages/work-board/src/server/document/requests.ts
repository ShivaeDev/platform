import { ServiceUnavailable } from "@shivaedev/platform/errors/taxonomy.ts";
import type { DocumentRequest } from "#browser/document/schema.ts";
import { authoredQuestion } from "#server/attention/inbox.ts";
import type { MetadataDocument } from "#server/metadata/model.ts";
import { responseHistory } from "#server/responses/history.ts";
import { questionId, revisionOf } from "#server/responses/records.ts";
import { requestSource } from "#server/responses/requestSource.ts";
import type { Snapshot } from "#server/search/snapshot.ts";

export function documentRequests(document: MetadataDocument, source: string, snapshot: Snapshot): readonly DocumentRequest[] {
	const item = document.parsed.fields.id;
	if (!item) {
		return [];
	}
	const ids = [
		...new Set([...(document.parsed.fields.attention?.map((request) => request.id) ?? []), ...(authoredQuestion(document) ? ["answer"] : [])]),
	];
	const reviewedRevision = revisionOf(source);
	return ids.map((id) => {
		const active = requestSource(snapshot, item, id);
		const preview = {
			context: source,
			id: questionId(item, id, reviewedRevision, document.file),
			item,
			reason: active?.reason ?? document.parsed.fields.attention?.find((entry) => entry.id === id)?.reason ?? "A question needs your answer",
			request: id,
			reviewedRevision,
			source: document.file,
		};
		const request = { id, open: active !== undefined, ...(active ? { preview } : {}) };
		try {
			if (snapshot.model.ids.get(item)?.length !== 1) {
				throw new ServiceUnavailable({ message: "Item identity is ambiguous; response history is unknown. Give each item a unique ID, then retry." });
			}
			return { ...request, responses: responseHistory(snapshot, preview) };
		} catch (error) {
			return { ...request, unavailable: error instanceof Error ? error.message : String(error) };
		}
	});
}
