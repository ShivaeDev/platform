import { ServiceUnavailable } from "@shivaedev/errors/taxonomy.ts";
import type { DocumentRequest, RequestState } from "#browser/document/schema.ts";
import { errorMessage } from "#errorMessage.ts";
import { addressedElsewhere, authoredQuestion, openItem } from "#server/attention/inbox.ts";
import { requestInbox } from "#server/attention/requestInbox.ts";
import { attentionRequests, isMaintainerRequest } from "#server/attention/requests.ts";
import { documentSource, type MetadataDocument } from "#server/metadata/model.ts";
import { responseHistory } from "#server/responses/history.ts";
import { questionPreview } from "#server/responses/questionPreview.ts";
import { requestSource } from "#server/responses/requestSource.ts";
import { questionTemplate } from "#server/responses/template.ts";
import type { Snapshot } from "#server/search/snapshot.ts";
import { requestTitle } from "./requestTitle.ts";

interface ItemRequest {
	readonly active: { readonly document: MetadataDocument; readonly reason: string } | undefined;
	readonly document: MetadataDocument;
	readonly item: string;
	readonly request: string;
	readonly state: RequestState;
}

// The item header, its answer cards and the Now lanes all read an item's asks from this one list.
export function itemRequests(document: MetadataDocument, snapshot: Snapshot): readonly ItemRequest[] {
	const own = sourceRequests(document, snapshot);
	const item = document.parsed.fields.id;
	if (!openItem(document)) {
		return own.map((request) => ({ ...request, active: undefined, state: { ...request.state, open: false } }));
	}
	const linked = attentionRequests(snapshot).entries.flatMap((entry) => {
		if (entry.document.file === document.file || !entry.request.unblocks.some((target) => target.split("#")[0] === item)) {
			return [];
		}
		return sourceRequests(entry.document, snapshot)
			.filter((request) => request.state.open && request.request === entry.request.id)
			.map((request) => ({ ...request, state: { ...request.state, id: `${entry.itemId}/${request.request}` } }));
	});
	return [...own, ...linked];
}

export function documentRequests(document: MetadataDocument, source: string, snapshot: Snapshot): readonly DocumentRequest[] {
	return itemRequests(document, snapshot).map((request) =>
		requestDetails(request, request.document === document ? source : documentSource(request.document), snapshot),
	);
}

function sourceRequests(document: MetadataDocument, snapshot: Snapshot): readonly ItemRequest[] {
	const item = document.parsed.fields.id;
	if (!item) {
		return [];
	}
	const ids = [
		...new Set([...(document.parsed.fields.attention?.map((request) => request.id) ?? []), ...(authoredQuestion(document) ? ["answer"] : [])]),
	];
	return ids.map((id) => {
		const { active, answered } = requestState(document, snapshot, item, id);
		return {
			active,
			document,
			item,
			request: id,
			state: {
				answered,
				audience: audienceOf(document, id, snapshot),
				id,
				open: active !== undefined,
				sourceOpen: requestOpenInSource(document, id),
			},
		};
	});
}

function audienceOf(document: MetadataDocument, id: string, snapshot: Snapshot): RequestState["audience"] {
	const maintainer = snapshot.maintainer ?? "maintainer";
	const request = document.parsed.fields.attention?.find((entry) => entry.id === id);
	if (request) {
		return isMaintainerRequest(request, maintainer) ? "you" : "agents";
	}
	return addressedElsewhere(document, maintainer) ? "agents" : "you";
}

function requestDetails({ active, document, item, request: id, state }: ItemRequest, source: string, snapshot: Snapshot): DocumentRequest {
	const reason = active?.reason ?? document.parsed.fields.attention?.find((entry) => entry.id === id)?.reason ?? "A question needs your answer";
	const preview = questionPreview(document, id, reason, snapshot.model);
	const request = {
		...state,
		options: document.parsed.fields.options,
		recommended: document.parsed.fields.recommended,
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
			return { ...request, promptUnavailable: errorMessage(error), responses };
		}
	} catch (error) {
		return { ...request, unavailable: errorMessage(error) };
	}
}

export function requestOpenInSource(document: MetadataDocument, id: string): boolean {
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
