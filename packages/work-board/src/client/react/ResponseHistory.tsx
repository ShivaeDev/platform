import type { DocumentRequest } from "#browser/document/schema.ts";
import { chosenLabels } from "#browser/responses/cardContext.ts";
import type { RecordedResponse } from "#browser/responses/schema.ts";
import { Age } from "./Age.tsx";
import { AnswerMarkdown } from "./AnswerMarkdown.tsx";
import { EmptyState } from "./EmptyState.tsx";
import { shellIds } from "./shellIds.ts";

const KINDS = { "answer": "answered", "clarify": "asked back", "not_now": "said not now" } as const;

export function ResponseHistory({
	request,
	id = shellIds.responseHistory,
}: {
	readonly request: DocumentRequest | undefined;
	readonly id?: string | undefined;
}) {
	const records = request?.responses ?? [];
	const preview = request?.preview;
	return (
		<section className="space-y-3 border-t pt-4" id={id}>
			<h2 className="font-medium text-sm">Recorded responses</h2>
			{records.length === 0 ? (
				<EmptyState title="No responses yet">Answers recorded for this question appear here.</EmptyState>
			) : (
				records.map((record) => (
					<ResponseEntry current={record.response.question === preview?.id} key={record.id} record={record} request={request} />
				))
			)}
		</section>
	);
}
function ResponseEntry({
	record,
	current,
	request,
}: {
	readonly record: RecordedResponse;
	readonly current: boolean;
	readonly request: DocumentRequest | undefined;
}) {
	const answers = record.response.answers;
	const chosen = chosenLabels(request?.prompts ?? [], answers, request?.options);
	const notes = (answers ?? []).map((answer) => answer.text.trim()).filter(Boolean);
	return (
		<article className="space-y-2 rounded-lg bg-muted/50 px-4 py-3 text-sm" id={record.id}>
			<h3 className="flex flex-wrap items-baseline gap-x-1.5 font-normal">
				<a className="font-medium underline-offset-4 hover:underline" href={`/responses/${record.id}.md`}>
					{record.response.author}
				</a>
				<span className="text-muted-foreground">{KINDS[record.response.type]}</span>
				<Age modified={record.response.recordedAt} short />
			</h3>
			{answers === undefined ? (
				<AnswerMarkdown file={`responses/${record.id}.md`} source={record.body} />
			) : (
				<>
					<p>
						<span className="text-muted-foreground">Chose </span>
						<strong className="font-medium">{chosen || "no listed option"}</strong>
					</p>
					{notes.map((note) => (
						<p className="whitespace-pre-wrap" key={note}>
							{note}
						</p>
					))}
					<details className="text-muted-foreground text-xs">
						<summary className="cursor-pointer select-none">Full response</summary>
						<AnswerMarkdown className="mt-2 text-foreground text-sm" file={`responses/${record.id}.md`} source={record.body} />
					</details>
				</>
			)}
			<p className="text-muted-foreground text-xs" title={record.response.reviewedRevision}>
				{current ? "This reviewed revision" : "Earlier reviewed context — does not approve the current source"} ·{" "}
				<code>{record.response.reviewedRevision.slice(0, 12)}</code>
			</p>
			{Boolean(record.response.supersedes) && (
				<p className="text-muted-foreground text-xs">
					Explicitly supersedes <a href={`/responses/${record.response.supersedes}.md`}>{record.response.supersedes}</a>.
				</p>
			)}
		</article>
	);
}
