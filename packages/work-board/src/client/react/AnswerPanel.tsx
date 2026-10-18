import { MessageCircleQuestion } from "lucide-react";
import type { Document, DocumentRequest } from "#browser/document/schema.ts";
import { reasonMarkdown } from "#browser/responses/reasonMarkdown.ts";
import { AnswerContext } from "./AnswerContext.tsx";
import { AnswerForm } from "./AnswerForm.tsx";
import { AnswerMarkdown } from "./AnswerMarkdown.tsx";
import { ResponseHistory } from "./ResponseHistory.tsx";

export function AnswerPanel({ document: data }: { readonly document: Document }) {
	const requests = data.requests.filter(
		(request) =>
			request.open || (request.id === "answer" && request.sourceOpen && data.metadata.kind === "question" && data.metadata.question === undefined),
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
	const source = {
		...data,
		file: preview?.source ?? data.file,
		metadata: { ...data.metadata, options: request.options, recommended: request.recommended },
	};
	const unavailable = request.unavailable ?? request.promptUnavailable;
	const closed = request.sourceOpen === false;
	return (
		<section
			aria-labelledby={`answer-title-${request.id}`}
			className="response-panel max-w-[72ch] space-y-5 rounded-xl border bg-card p-5 text-card-foreground shadow-sm"
			id={`answer-card-${request.id}`}
			tabIndex={-1}
		>
			<h2 className="flex items-center gap-2 font-medium text-muted-foreground text-sm" id={`answer-title-${request.id}`}>
				{request.open ? <MessageCircleQuestion aria-hidden="true" className="size-4 text-needs-you" /> : null}
				{cardTitle(request, closed)}
			</h2>
			{!(request.open || unavailable) && (
				<p className="text-muted-foreground text-sm" role="status">
					{closed ? "This question is closed. Recorded answers remain below." : "Answer unavailable. Check the source diagnostics."}
				</p>
			)}
			{Boolean(unavailable) && (
				<p className="rounded-md border border-destructive/40 px-3 py-2 text-sm" role="status">
					{unavailable}
				</p>
			)}
			{request.open && preview !== undefined && (
				<>
					<AnswerMarkdown className="answer-reason font-medium text-base" file={source.file} source={reasonMarkdown(preview.reason)} />
					<AnswerContext preview={preview} />
				</>
			)}
			{request.open && preview && !unavailable && <AnswerForm document={source} preview={preview} request={request} />}
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
