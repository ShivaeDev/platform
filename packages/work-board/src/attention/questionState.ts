import type { Question } from "#browser/responses/schema.ts";
import type { MetadataDocument, MetadataModel } from "#metadata/model.ts";
import { metadataParse } from "#metadata/parse.ts";
import { questionFrom, responseFrom } from "#responses/records.ts";
import { responseUrl } from "#responses/url.ts";
import type { Snapshot } from "#search/snapshot.ts";
import { attentionRequests, isMaintainerRequest } from "./requests.ts";

function currentSource(question: Question, document: MetadataDocument): boolean {
	const captured = metadataParse(question.context);
	return question.question.source === document.file && captured.raw === document.parsed.raw && captured.body === document.parsed.body;
}

function hasAnswer(question: Question, model: MetadataModel): boolean {
	return model.documents.some((source) => {
		const response = responseFrom(source);
		return (
			response?.response.question === question.id
			&& response.response.type === "answer"
			&& response.response.reviewedRevision === question.question.reviewedRevision
			&& model.ids.get(response.id)?.length === 1
		);
	});
}

export function answeredQuestion(document: MetadataDocument, model: MetadataModel): boolean {
	return model.documents.some((candidate) => {
		const question = questionFrom(candidate);
		return (
			question !== undefined
			&& question.question.item === document.parsed.fields.id
			&& model.ids.get(question.id)?.length === 1
			&& currentSource(question, document)
			&& hasAnswer(question, model)
		);
	});
}

export function pendingQuestions(snapshot: Snapshot) {
	const open = attentionRequests(snapshot).entries.filter((entry) => isMaintainerRequest(entry.request, snapshot.maintainer));
	const titles = new Map(snapshot.entries.filter((entry) => entry.kind === "document").map((entry) => [entry.file, entry.title]));
	return snapshot.documents.flatMap((captured) => {
		const question = questionFrom(captured);
		if (!question || modelAmbiguous(question, snapshot.model) || hasAnswer(question, snapshot.model)) {
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
