import { Hourglass, MessageCircleQuestion } from "lucide-react";
import { useContext, useEffect, useRef } from "react";
import type { Document, DocumentRequest } from "#browser/document/schema.ts";
import { reasonMarkdown } from "#browser/responses/reasonMarkdown.ts";
import { answeredCopy } from "#client/responses/answeredCopy.ts";
import { AnswerContext } from "./AnswerContext.tsx";
import { AnswerControls } from "./AnswerControls.tsx";
import { AnswerMarkdown } from "./AnswerMarkdown.tsx";
import { ClosedDraftCard } from "./ClosedDraftCard.tsx";
import { FleetItemsContext } from "./FleetItemsContext.ts";
import { itemAsks } from "./itemStatus.ts";
import { ResponseHistory } from "./ResponseHistory.tsx";
import { useClosedDrafts } from "./useClosedDrafts.ts";

export function AnswerPanel({ after = false, document: data }: { readonly after?: boolean; readonly document: Document }) {
	const requests = itemAsks(data);
	const { closed, record: handleDraft } = useClosedDrafts(data);
	const shown = closed.filter((entry) => !requests.some((request) => request.id === entry.id));
	return requests.length + shown.length > 0 ? (
		<div
			className={after ? "answer-cards min-w-0 space-y-4 lg:col-start-1" : "answer-cards col-span-full space-y-4"}
			data-after={after ? "" : undefined}
		>
			{requests.map((request) => (
				<AnswerCard document={data} key={request.id} onDraft={handleDraft} request={request} />
			))}
			{shown.map((draft) => (
				<ClosedDraftCard draft={draft} key={draft.id} />
			))}
		</div>
	) : null;
}

function AnswerCard({
	document: data,
	onDraft,
	request,
}: {
	readonly document: Document;
	readonly onDraft: (request: DocumentRequest, text: string) => void;
	readonly request: DocumentRequest;
}) {
	const preview = request.preview;
	const source = {
		...data,
		file: preview?.source ?? data.file,
		metadata: { ...data.metadata, options: request.options, recommended: request.recommended },
	};
	const fleet = useContext(FleetItemsContext);
	const unavailable = request.unavailable ?? request.promptUnavailable;
	const closed = request.sourceOpen === false;
	const answered = request.open ? request.answered : undefined;
	const statusRef = useRef<HTMLParagraphElement>(null);
	const shownRef = useRef(answered?.response);
	useEffect(() => {
		if (answered !== undefined && answered.response !== shownRef.current) {
			statusRef.current?.focus();
		}
		shownRef.current = answered?.response;
	}, [answered]);
	return (
		<section
			aria-labelledby={`answer-title-${request.id}`}
			className="response-panel max-w-[72ch] space-y-5 rounded-xl border bg-card p-5 text-card-foreground shadow-sm"
			id={`answer-card-${request.id}`}
			tabIndex={-1}
		>
			<h2 className="flex items-center gap-2 font-medium text-muted-foreground text-sm" id={`answer-title-${request.id}`}>
				{answered !== undefined && <Hourglass aria-hidden="true" className="size-4 text-waiting-on-agents" />}
				{request.open && answered === undefined && <MessageCircleQuestion aria-hidden="true" className="size-4 text-needs-you" />}
				{cardTitle(request, closed)}
			</h2>
			{answered !== undefined && (
				<p
					className="rounded-md border border-waiting-on-agents/40 bg-waiting-on-agents/10 px-3 py-2 text-sm"
					data-answered=""
					ref={statusRef}
					role="status"
					tabIndex={-1}
				>
					{answeredCopy(answered, fleet)}
				</p>
			)}
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
			{preview && !unavailable && (
				<AnswerControls
					answered={answered !== undefined}
					onDraft={(text) => onDraft(request, text)}
					open={request.open}
					preview={preview}
					request={request}
					source={source}
				/>
			)}
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
		return `${request.answered ? "Answered" : "Answer"}: ${request.title ?? "this question"}`;
	}
	return closed ? "Question closed" : "Answer unavailable";
}
