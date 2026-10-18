import { ServiceUnavailable } from "@shivaedev/platform/errors/taxonomy.ts";
import type { DocumentRequest } from "#browser/document/schema.ts";
import { authoredQuestion, openItem } from "#server/attention/inbox.ts";
import { requestInbox } from "#server/attention/requestInbox.ts";
import { attentionRequests } from "#server/attention/requests.ts";
import type { MetadataDocument } from "#server/metadata/model.ts";
import { responseHistory } from "#server/responses/history.ts";
import { questionId, revisionOf } from "#server/responses/records.ts";
import { requestSource } from "#server/responses/requestSource.ts";
import { questionTemplate } from "#server/responses/template.ts";
import type { Snapshot } from "#server/search/snapshot.ts";
import { requestTitle } from "./requestTitle.ts";

export function documentRequests(document: MetadataDocument, source: string, snapshot: Snapshot): readonly DocumentRequest[] {
	const own = sourceRequests(document, source, snapshot);
	const item = document.parsed.fields.id;
	if (!openItem(document)) {
		return own.map((request) => ({ ...request, open: false, preview: undefined }));
	}
	const linked = attentionRequests(snapshot).entries.flatMap((entry) => {
		if (entry.document.file === document.file || !entry.request.unblocks.some((target) => target.split("#")[0] === item)) {
			return [];
		}
		const context = (entry.document.parsed.raw ?? "") + entry.document.parsed.body;
		return sourceRequests(entry.document, context, snapshot)
			.filter((request) => request.open && request.id === entry.request.id)
			.map((request) => ({ ...request, id: `${entry.itemId}/${request.id}` }));
	});
	return [...own, ...linked];
}

function sourceRequests(document: MetadataDocument, source: string, snapshot: Snapshot): readonly DocumentRequest[] {
	const item = document.parsed.fields.id;
	if (!item) {
		return [];
	}
	const ids = [
		...new Set([...(document.parsed.fields.attention?.map((request) => request.id) ?? []), ...(authoredQuestion(document) ? ["answer"] : [])]),
	];
	const reviewedRevision = revisionOf(source);
	return ids.map((id) => {
		const { active, answered } = requestState(document, snapshot, item, id);
		const preview = {
			context: source,
			id: questionId(item, id, reviewedRevision, document.file),
			item,
			reason: active?.reason ?? document.parsed.fields.attention?.find((entry) => entry.id === id)?.reason ?? "A question needs your answer",
			request: id,
			reviewedRevision,
			source: document.file,
		};
		const request = {
			answered,
			id,
			open: active !== undefined,
			options: document.parsed.fields.options,
			recommended: document.parsed.fields.recommended,
			sourceOpen: requestOpenInSource(document, id),
			title: requestTitle(document, snapshot, id),
			...(active ? { preview } : {}),
		};
		try {
			if (snapshot.model.ids.get(item)?.length !== 1) {
				throw new ServiceUnavailable({ message: "Item identity is ambiguous; response history is unknown. Give each item a unique ID, then retry." });
			}
			const responses = responseHistory(snapshot, preview);
			try {
				return { ...request, prompts: questionTemplate(source, id, document.file).prompts, responses };
			} catch (error) {
				return { ...request, promptUnavailable: error instanceof Error ? error.message : String(error), responses };
			}
		} catch (error) {
			return { ...request, unavailable: error instanceof Error ? error.message : String(error) };
		}
	});
}

function requestOpenInSource(document: MetadataDocument, id: string): boolean {
	if (authoredQuestion(document) && id === "answer") {
		return openItem(document);
	}
	return document.parsed.fields.attention?.find((entry) => entry.id === id)?.state === "open";
}

function requestState(document: MetadataDocument, snapshot: Snapshot, item: string, id: string) {
	if (document.parsed.fields.attention?.find((entry) => entry.id === id)?.managed !== true) {
		return { active: requestSource(snapshot, item, id), answered: undefined };
	}
	const inbox = requestInbox(snapshot);
	const ask = [...inbox.items, ...inbox.answered].find((entry) => entry.document.file === document.file && entry.request === id);
	return { active: ask && requestSource(snapshot, item, id), answered: ask?.answered };
}
