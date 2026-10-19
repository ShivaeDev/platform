import { openItem } from "#server/attention/inbox.ts";
import type { MetadataDocument } from "#server/metadata/model.ts";
import { responseIndex } from "#server/responseIndex.ts";
import { questionFrom } from "#server/responses/records.ts";
import type { Snapshot } from "#server/search/snapshot.ts";
import { requestOpenInSource } from "./requests.ts";

export function requestOutcome(document: MetadataDocument, snapshot: Snapshot): "answered" | "closed" | undefined {
	const { id, kind } = document.parsed.fields;
	if (!id || (kind !== "decision" && kind !== "question")) {
		return undefined;
	}
	const index = responseIndex(snapshot.model);
	const receipt = questionFrom(document);
	if ((receipt ? [receipt] : index.questionsFor(id)).some((question) => index.responsesFor(question).answered)) {
		return "answered";
	}
	if (!receipt) {
		return "closed";
	}
	const sources = snapshot.model.ids.get(receipt.question.item) ?? [];
	const [source] = sources;
	if (sources.length !== 1 || !source) {
		return undefined;
	}
	return openItem(source) && requestOpenInSource(source, receipt.question.request) ? undefined : "closed";
}
