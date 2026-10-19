import { CircleAlert } from "lucide-react";
import type { HandoffProjection } from "#browser/views/remaining.ts";
import { statusLabel } from "#browser/views/statusLabel.ts";
import { fileUrl } from "#files/url.ts";
import { Alert, AlertDescription, AlertTitle } from "#client/react/components/ui/alert.tsx";
import { Badge } from "#client/react/components/ui/badge.tsx";
import { HandoffForm } from "./HandoffForm.tsx";
import { HandoffPrompt } from "./HandoffPrompt.tsx";
import { LinkButton } from "./LinkButton.tsx";
import { PageHeader } from "./PageHeader.tsx";
import { ReadingPanel } from "./ReadingPanel.tsx";
import { ResponseMarkdown } from "./ResponseMarkdown.tsx";
import { SectionCard } from "./SectionCard.tsx";
import { shellIds } from "./shellIds.ts";
import { Version } from "./Version.tsx";

type HandoffRecord = HandoffProjection["reading"]["records"][number];

const receipts: Readonly<Record<HandoffRecord["handoff"]["state"], string>> = {
	acknowledged: "The agent confirmed it got this. That doesn't mean the work is done.",
	rejected: "The agent declined this handoff.",
	requested: "Waiting for the agent to confirm it got this.",
	unavailable: "The agent couldn't take this handoff.",
};

export function HandoffPage({ data }: { readonly data: HandoffProjection }) {
	const item = `/_board/item/${encodeURIComponent(data.item)}/`;
	return (
		<ReadingPanel>
			<PageHeader
				actions={<LinkButton href={item}>Back to item</LinkButton>}
				summary={
					<div className="space-y-2">
						<p className="m-0 font-mono text-foreground text-xs">{data.item}</p>
						<p className="m-0">
							Write down what the agent should do next. The Board saves it as a file and gives you a short prompt to paste into your agent session.
							Nothing starts until you paste it.
						</p>
					</div>
				}
				title="Hand off to an agent"
			/>
			{Boolean(data.source) && (
				<SectionCard title="About this item">
					<div className="response-context reading-column [&>:first-child]:mt-0 [&>:last-child]:mb-0">
						<ResponseMarkdown file={data.source?.source ?? ""} source={data.background} />
					</div>
				</SectionCard>
			)}
			<HandoffForm data={data} />
			<SectionCard id={shellIds.handoffHistory} title="Earlier handoffs">
				{data.reading.unknown.length > 0 && (
					<Alert>
						<CircleAlert aria-hidden="true" />
						<AlertTitle>Some handoff files couldn't be read</AlertTitle>
						<AlertDescription>{data.reading.unknown.join(", ")}. There may be handoffs or receipts that aren't shown here.</AlertDescription>
					</Alert>
				)}
				{data.reading.records.length === 0 && <p className="m-0 text-muted-foreground">No handoffs yet.</p>}
				{data.reading.records.map((record) => (
					<HandoffEntry current={data.source} key={record.id} record={record} />
				))}
			</SectionCard>
		</ReadingPanel>
	);
}

function HandoffEntry({ record, current }: { readonly record: HandoffRecord; readonly current: HandoffProjection["source"] }) {
	const h = record.handoff;
	const same = current?.reviewedRevision === h.reviewedRevision && current.source === h.source;
	return (
		<article className="min-w-0 space-y-3 rounded-lg border p-4" data-receipt={h.state} id={record.id}>
			<header className="flex flex-wrap items-center gap-2">
				<h3 className="m-0 font-semibold text-sm">{h.recipient}</h3>
				<Badge variant="outline">{statusLabel(h.state)}</Badge>
				<a className="ml-auto text-muted-foreground text-xs" href={fileUrl(record.file)}>
					Open file
				</a>
			</header>
			<p className="m-0 text-muted-foreground">
				{receipts[h.state]}
				{Boolean(h.by || h.note) && ` ${[h.by, h.note].filter(Boolean).join(": ")}`}
			</p>
			<p className="m-0 text-muted-foreground" data-current-source={same}>
				{same ? "Written for the current version of " : "Written for an earlier version of "}
				<a href={fileUrl(h.source)}>{h.source}</a> (<Version revision={h.reviewedRevision} />)
				{same ? "." : ", or one that can't be read now. Check it still applies before acting on it."}
			</p>
			<dl className="m-0 grid gap-x-4 gap-y-2 sm:grid-cols-[8rem_minmax(0,1fr)]">
				<dt className="font-medium">Goal</dt>
				<dd className="reading-column m-0 [&>:first-child]:mt-0 [&>:last-child]:mb-0">
					<ResponseMarkdown file={h.source} source={h.goal} />
				</dd>
				<dt className="font-medium">Constraints</dt>
				<dd className="reading-column m-0 [&>:first-child]:mt-0 [&>:last-child]:mb-0">
					{h.constraints ? <ResponseMarkdown file={h.source} source={h.constraints} /> : <p className="text-muted-foreground">None</p>}
				</dd>
				<dt className="font-medium">Next step</dt>
				<dd className="reading-column m-0 [&>:first-child]:mt-0 [&>:last-child]:mb-0">
					<ResponseMarkdown file={h.source} source={h.nextAction} />
				</dd>
			</dl>
			<HandoffPrompt id={record.id} prompt={record.prompt} />
			<details className="rounded-md border px-3 py-2">
				<summary className="cursor-pointer font-medium">Item as handed off</summary>
				<pre className="mt-2 max-h-96 overflow-auto whitespace-pre-wrap rounded-md bg-muted p-3 font-mono text-xs">{record.context}</pre>
			</details>
		</article>
	);
}
