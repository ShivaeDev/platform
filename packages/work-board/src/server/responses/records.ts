import { createHash } from "node:crypto";
import { stringify } from "yaml";
import type { DraftInput, Question, Reading, RecordedResponse } from "#browser/responses/schema.ts";
import type { MetadataDocument } from "#server/metadata/model.ts";

export function revisionOf(source: string) {
	return createHash("sha256").update(source).digest("hex");
}
export function questionId(item: string, request: string, revision: string, source: string) {
	return `question.${revisionOf(JSON.stringify([item, request, revision, source]))}`;
}
export function questionMarkdown(record: Question, urgency: "blocking" | "whenever" = "whenever"): string {
	return `---\n${stringify({ id: record.id, kind: "question", question: record.question, scope: "task", urgency })}---\n${record.context}`;
}
export function responseMarkdown(record: RecordedResponse): string {
	return `---\n${stringify({ id: record.id, response: record.response })}---\n${record.body}`;
}
export function questionFrom(document: MetadataDocument): Question | undefined {
	const { id, kind, question } = document.parsed.fields;
	return id
		&& kind === "question"
		&& question
		&& question.reviewedRevision === revisionOf(document.parsed.body)
		&& id === questionId(question.item, question.request, question.reviewedRevision, question.source)
		? { context: document.parsed.body, id, question }
		: undefined;
}
export function responseFrom(document: MetadataDocument): RecordedResponse | undefined {
	const { id, response } = document.parsed.fields;
	return id && response ? { body: document.parsed.body, id, response } : undefined;
}
export function responsesFor(documents: readonly MetadataDocument[], question: Question): Reading {
	const responses = documents.flatMap((document) => {
		const record = responseFrom(document);
		return record?.response.question === question.id && record.response.reviewedRevision === question.question.reviewedRevision ? [record] : [];
	});
	responses.sort((a, b) => a.response.recordedAt - b.response.recordedAt || a.id.localeCompare(b.id));
	return { question, responses };
}

export function matchesResponse(record: RecordedResponse, input: DraftInput) {
	return (
		record.body === input.body
		&& JSON.stringify(record.response.answers) === JSON.stringify(input.answers)
		&& record.response.supersedes === input.supersedes
		&& record.response.author === input.author
		&& record.response.type === input.type
		&& record.response.question === input.question
	);
}

export function malformedResponse(document: MetadataDocument) {
	const fields = document.parsed.fields;
	return (
		((fields.response !== undefined || document.parsed.diagnostics.some((problem) => problem.field === "response"))
			&& !(fields.id && fields.response))
		|| (document.file.startsWith("responses/") && document.parsed.diagnostics.some((problem) => problem.field === undefined))
	);
}
