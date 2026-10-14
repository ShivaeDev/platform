import type { Document, DocumentRequest } from "#browser/document/schema.ts";
import { reasonMarkdown } from "#browser/responses/reasonMarkdown.ts";
import { AnswerForm } from "./AnswerForm.tsx";
import { ResponseHistory } from "./ResponseHistory.tsx";
import { ResponseMarkdown } from "./ResponseMarkdown.tsx";

export function AnswerPanel({ document: data }: { readonly document: Document }) {
	const requests = data.requests.filter(
		(request) => request.open || (request.id === "answer" && data.metadata.kind === "question" && data.metadata.question === undefined),
	);
	return requests.length > 0 ? (
		<div className="answer-cards col-span-full space-y-4">
			{requests.map((request) => (
				<AnswerCard document={data} key={request.id} request={request} />
			))}
		</div>
	) : null;
}
function AnswerCard({ document: data, request }: { readonly document: Document; readonly request: DocumentRequest }) {
	const preview = request.preview;
	const unavailable = request.unavailable ?? request.promptUnavailable;
	const closed = request.sourceOpen === false;
	return (
		<section
			aria-labelledby={`answer-title-${request.id}`}
			className="response-panel rounded-lg border border-border bg-card p-4"
			id={`answer-card-${request.id}`}
			tabIndex={-1}
		>
			<h2 id={`answer-title-${request.id}`}>{cardTitle(request, closed)}</h2>
			{!(request.open || unavailable) && (
				<p role="status">
					{closed ? "This question is closed. Recorded answers remain below." : "Answer unavailable. Check the source diagnostics."}
				</p>
			)}
			{Boolean(unavailable) && <p role="status">{unavailable}</p>}
			{request.open && preview !== undefined && (
				<div className="answer-reason">
					<ResponseMarkdown file={data.file} source={reasonMarkdown(preview.reason)} />
				</div>
			)}
			{request.open && preview && !unavailable && <AnswerForm document={data} preview={preview} request={request} />}
			{!request.unavailable && (
				<ResponseHistory
					id={data.requests.filter((entry) => entry.open).length > 1 ? `response-history-${request.id}` : undefined}
					request={request}
				/>
			)}
		</section>
	);
}

function cardTitle(request: DocumentRequest, closed: boolean) {
	if (request.open) {
		return `Answer: ${request.title ?? "this question"}`;
	}
	return closed ? "Question closed" : "Answer unavailable";
}
