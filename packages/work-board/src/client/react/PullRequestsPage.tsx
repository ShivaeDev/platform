import type { FleetItemsProjection } from "#browser/views/FleetItemsProjection.ts";
import {
	currentPullRequests,
	type PullRequestGroup,
	type PullRequestItem,
	pullRequestGroup,
	pullRequestGroups,
} from "#browser/views/pullRequests.ts";
import { useNow } from "#client/react/now.ts";
import { exactTime } from "#client/react/timeLabel.ts";
import { fileUrl } from "#files/url.ts";

export function PullRequestsPage({ data }: { readonly data: FleetItemsProjection }) {
	const items = currentPullRequests(data);
	return (
		<div className="mx-auto max-w-4xl space-y-8">
			<header className="space-y-2">
				<h1 className="text-2xl font-semibold">Pull requests</h1>
				<p className="text-muted-foreground">Fleet’s current pull requests, with those waiting for a merge first.</p>
			</header>
			{data.state === "unavailable" ? <p role="status">{data.reason}</p> : null}
			{data.state === "ready" && items.length === 0 ? <p>No current pull requests. Fleet’s PRs appear here when it reports them.</p> : null}
			{pullRequestGroups.map((group) => (
				<PullRequestSection group={group} items={items} key={group} />
			))}
		</div>
	);
}

function PullRequestSection({ group, items }: { readonly group: PullRequestGroup; readonly items: readonly PullRequestItem[] }) {
	const rows = items.filter((item) => pullRequestGroup(item) === group);
	if (rows.length === 0) {
		return null;
	}
	return (
		<section aria-label={group} className="space-y-3">
			<h2 className="text-lg font-semibold">
				{group} <span className="text-muted-foreground">({rows.length})</span>
			</h2>
			<ul className="divide-y rounded-lg border px-4">
				{rows.map((item) => (
					<PullRequestRow item={item} key={item.workId} />
				))}
			</ul>
		</section>
	);
}

function PullRequestRow({ item }: { readonly item: PullRequestItem }) {
	const number = item.prUrl?.match(/\/pull\/(?<number>\d+)/u)?.groups?.number;
	return (
		<li className="flex flex-wrap items-baseline gap-x-4 gap-y-1 py-3" data-pr-work={item.workId}>
			<a className="text-primary font-medium" href={item.prUrl}>
				#{number}
			</a>
			<div className="min-w-0 flex-1 basis-48 [overflow-wrap:anywhere]">
				{item.document ? <a href={fileUrl(item.document.file)}>{item.document.title}</a> : <span>{item.workId}</span>}
				<p className="text-muted-foreground text-xs">{item.workId}</p>
				{item.readyToMerge && item.review ? (
					<div className="mt-2 space-y-1 text-sm">
						<a className="text-primary" href={fileUrl(item.review.sourcePath)}>
							Review document
						</a>
						<p className="whitespace-pre-line">{item.review.tldr}</p>
					</div>
				) : null}
			</div>
			<span className="text-muted-foreground text-sm">
				{item.stageEnteredAt === null ? "State age unknown" : <StateAge at={item.stageEnteredAt} />}
			</span>
		</li>
	);
}

function StateAge({ at }: { readonly at: number }) {
	const minutes = Math.max(0, Math.floor((useNow() - at) / 60_000));
	let age = `${Math.floor(minutes / 1440)}d`;
	if (minutes < 1) {
		age = "Less than a minute";
	} else if (minutes < 60) {
		age = `${minutes}m`;
	} else if (minutes < 1440) {
		age = `${Math.floor(minutes / 60)}h`;
	}
	return (
		<time dateTime={new Date(at).toISOString()} title={`In this state since ${exactTime(at)}`}>
			{age} in this state
		</time>
	);
}
