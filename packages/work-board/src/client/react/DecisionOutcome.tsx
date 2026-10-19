import { useId } from "react";
import type { Document, DocumentRequest } from "#browser/document/schema.ts";
import { chosenLabels } from "#browser/responses/cardContext.ts";
import type { RecordedResponse } from "#browser/responses/schema.ts";
import { closedStatus } from "#browser/views/workStatus.ts";
import { currentResponses } from "#responses/current.ts";
import { AnswerMarkdown } from "./AnswerMarkdown.tsx";
import { itemStatus } from "./itemStatus.ts";
import { Time } from "./Time.tsx";

export function DecisionOutcome({ document }: { readonly document: Document }) {
	const id = useId();
	const kind = document.metadata.kind;
	const status = itemStatus(document);
	if ((kind !== "decision" && kind !== "question") || !(status === "answered" || (closedStatus(status) && closedInSource(document)))) {
		return null;
	}
	const unavailable = document.requests.find((request) => request.unavailable)?.unavailable;
	const answers = document.requests.flatMap((request) =>
		currentResponses(request.responses ?? [])
			.filter((record) => record.response.type === "answer")
			.map((record) => ({ record, request })),
	);
	return (
		<section aria-labelledby={id} className="mb-6 space-y-3 rounded-lg border bg-muted/40 px-4 py-3" data-decision-outcome="">
			<h2 className="m-0 font-medium text-muted-foreground text-sm" id={id}>
				Outcome
			</h2>
			{unavailable !== undefined && <p className="m-0 text-sm">{unavailable}</p>}
			{unavailable === undefined && answers.length === 0 && <p className="m-0 text-sm">Closed with no answer recorded on the Board.</p>}
			{unavailable === undefined && answers.map(({ record, request }) => <RecordedAnswer key={record.id} record={record} request={request} />)}
		</section>
	);
}

// The Board also calls an unanswered item without a status closed; only the source's own word closes it.
function closedInSource(document: Document) {
	const attention = document.metadata.attention ?? [];
	return closedStatus(document.metadata.status) || (attention.length > 0 && attention.every((request) => request.state !== "open"));
}

function RecordedAnswer({ record, request }: { readonly record: RecordedResponse; readonly request: DocumentRequest }) {
	const { answers, author, recordedAt } = record.response;
	const chosen = chosenLabels(request.prompts ?? [], answers, request.options);
	const notes = (answers ?? []).map((answer) => answer.text.trim()).filter(Boolean);
	return (
		<div className="space-y-1" data-outcome-answer={record.id}>
			{answers === undefined ? (
				<AnswerMarkdown className="text-base" file={`responses/${record.id}.md`} source={record.body} />
			) : (
				<p className="m-0 font-medium text-base">{chosen || "No listed option chosen"}</p>
			)}
			{notes.map((note) => (
				<p className="m-0 whitespace-pre-wrap text-sm" key={note}>
					{note}
				</p>
			))}
			<p className="m-0 text-muted-foreground text-sm">
				Answered by{" "}
				<a className="underline underline-offset-4 hover:text-foreground" href={`/responses/${record.id}.md`}>
					{author}
				</a>{" "}
				<Time at={recordedAt} />
			</p>
		</div>
	);
}
