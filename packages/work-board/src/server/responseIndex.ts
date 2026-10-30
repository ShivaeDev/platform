import type { Question, RecordedResponse } from "#browser/responses/schema.ts";
import type { MetadataDocument, MetadataModel } from "#integration/metadata.ts";
import { currentResponses } from "#responses/current.ts";
import { malformedResponse, questionFrom, responseFrom } from "#server/responses/records.ts";

interface ResponseGroup {
	readonly ambiguous: boolean;
	readonly answered: boolean;
	readonly current: readonly RecordedResponse[];
	readonly responses: readonly RecordedResponse[];
}
interface ResponseIndex {
	readonly malformed: boolean;
	readonly questions: ReadonlyMap<string, Question>;
	readonly questionsFor: (item: string, request?: string) => readonly Question[];
	readonly receiptProblems: boolean;
	readonly receipts: ReadonlyMap<string, readonly MetadataDocument[]>;
	readonly responses: ReadonlyMap<string, RecordedResponse>;
	readonly responsesFor: (question: Question) => ResponseGroup;
}

const cached = new WeakMap<MetadataModel, ResponseIndex>();
const empty: ResponseGroup = { ambiguous: false, answered: false, current: [], responses: [] };

function append<A>(groups: Map<string, A[]>, key: string, value: A) {
	const matches = groups.get(key) ?? [];
	matches.push(value);
	groups.set(key, matches);
}

function responseGroups(records: ReadonlyMap<string, RecordedResponse>, model: MetadataModel) {
	const grouped = new Map<string, RecordedResponse[]>();
	for (const record of records.values()) {
		append(grouped, `${record.response.question}\0${record.response.reviewedRevision}`, record);
	}
	return new Map(
		[...grouped].map(([key, responses]) => {
			responses.sort((left, right) => left.response.recordedAt - right.response.recordedAt || left.id.localeCompare(right.id));
			return [
				key,
				{
					ambiguous: responses.some((record) => model.ids.get(record.id)?.length !== 1),
					answered: responses.some((record) => record.response.type === "answer" && model.ids.get(record.id)?.length === 1),
					current: currentResponses(responses),
					responses,
				},
			] as const;
		}),
	);
}

function buildIndex(model: MetadataModel): ResponseIndex {
	const questions = new Map<string, Question>();
	const items = new Map<string, Question[]>();
	const requests = new Map<string, Question[]>();
	const responses = new Map<string, RecordedResponse>();
	const receipts = new Map<string, MetadataDocument[]>();
	let malformed = false;
	let receiptProblems = false;
	for (const document of model.documents) {
		const question = questionFrom(document);
		if (question) {
			questions.set(document.file, question);
			append(items, question.question.item, question);
			append(requests, `${question.question.item}\0${question.question.request}`, question);
		}
		const response = responseFrom(document);
		if (response) {
			responses.set(document.file, response);
		}
		const receipt = document.parsed.fields.requestReceipt;
		if (receipt) {
			append(receipts, receipt.question, document);
		}
		malformed ||= malformedResponse(document);
		receiptProblems ||= document.parsed.diagnostics.some((problem) => problem.field === "request_receipt" || problem.field === "requestReceipt");
	}
	const groups = responseGroups(responses, model);
	return {
		malformed,
		questions,
		questionsFor: (item, request) => (request === undefined ? items.get(item) : requests.get(`${item}\0${request}`)) ?? [],
		receiptProblems,
		receipts,
		responses,
		responsesFor: (question) => groups.get(`${question.id}\0${question.question.reviewedRevision}`) ?? empty,
	};
}

export function responseIndex(model: MetadataModel): ResponseIndex {
	let hit = cached.get(model);
	if (!hit) {
		hit = buildIndex(model);
		cached.set(model, hit);
	}
	return hit;
}
