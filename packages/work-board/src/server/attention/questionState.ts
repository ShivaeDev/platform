import type { Question } from "#browser/responses/schema.ts";
import { responseUrl } from "#responses/url.ts";
import type { MetadataDocument, MetadataModel } from "#server/metadata/model.ts";
import { responseIndex } from "#server/responseIndex.ts";
import type { Snapshot } from "#server/search/snapshot.ts";
import { attentionRequests, isMaintainerRequest } from "./requests.ts";

function currentSource(question: Question, document: MetadataDocument): boolean {
	return question.question.source === document.file && question.context === (document.parsed.raw ?? "") + document.parsed.body;
}

function hasAnswer(question: Question, model: MetadataModel): boolean {
	return responseIndex(model).responsesFor(question).answered;
}

export function answeredQuestion(document: MetadataDocument, model: MetadataModel): boolean {
	return responseIndex(model)
		.questionsFor(document.parsed.fields.id ?? "")
		.some(
			(question) =>
				question.question.item === document.parsed.fields.id
				&& model.ids.get(question.id)?.length === 1
				&& currentSource(question, document)
				&& hasAnswer(question, model),
		);
}

export function pendingQuestions(snapshot: Snapshot) {
	const open = attentionRequests(snapshot).entries.filter((entry) => isMaintainerRequest(entry.request, snapshot.maintainer));
	const titles = new Map(snapshot.entries.filter((entry) => entry.kind === "document").map((entry) => [entry.file, entry.title]));
	return [...responseIndex(snapshot.model).questions.values()].flatMap((question) => {
		if (modelAmbiguous(question, snapshot.model) || hasAnswer(question, snapshot.model)) {
			return [];
		}
		const source = snapshot.model.ids.get(question.question.item)?.[0];
		if (
			!(
				source
				&& currentSource(question, source)
				&& open.some((entry) => entry.itemId === question.question.item && entry.request.id === question.question.request)
			)
		) {
			return [];
		}
		return [
			{
				document: source,
				href: responseUrl(question.question.item, question.question.request),
				id: question.question.item,
				reason: question.question.reason,
				title: titles.get(source.file) ?? source.file,
			},
		];
	});
}

function modelAmbiguous(question: Question, model: MetadataModel): boolean {
	return model.ids.get(question.id)?.length !== 1 || model.ids.get(question.question.item)?.length !== 1;
}
