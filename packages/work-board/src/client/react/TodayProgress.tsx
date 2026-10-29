import type { FleetItemsProjection } from "#browser/views/FleetItemsProjection.ts";
import { inProgress, type ProgressRow as Row } from "#browser/views/inProgress.ts";
import { Badge } from "#client/react/components/ui/badge.tsx";
import { EmptyState } from "./EmptyState.tsx";
import { FleetStopped } from "./FleetStopped.tsx";
import { LoadingRows } from "./loading.tsx";

const FROM_FILES = "These show the status written in each task, not what Fleet reports.";

export function TodayProgress({ data, failed }: { readonly data: FleetItemsProjection | undefined; readonly failed: boolean }) {
	const progress = inProgress(data);
	return (
		<div className="space-y-3">
			{data === undefined && !failed && <LoadingRows label="Loading work in progress" />}
			{data?.state === "unavailable" && data.startCommand !== undefined ? (
				<FleetStopped command={data.startCommand} reason={data.reason}>
					{progress?.source === "files" && <p className="text-muted-foreground m-0">{FROM_FILES}</p>}
				</FleetStopped>
			) : (
				progress?.source !== "fleet"
				&& (data !== undefined || failed) && (
					<div className="text-muted-foreground text-sm" role="status">
						<p className="m-0">{unavailable(data)}</p>
						{progress?.source === "files" && <p className="m-0">{FROM_FILES}</p>}
					</div>
				)
			)}
			{progress?.rows.length === 0 && (
				<EmptyState title={progress.source === "files" ? "No ready tasks" : "No work in progress"}>
					{progress.source === "files" ? "No task is ready." : "Fleet is not working on anything right now."}
				</EmptyState>
			)}
			{progress !== undefined && progress.rows.length > 0 && (
				<ul
					aria-label={progress.source === "files" ? "Ready tasks" : "In progress"}
					className="border-border m-0 list-none divide-y rounded-lg border p-0"
					data-progress-source={progress.source}
				>
					{progress.rows.slice(0, 8).map((item) => (
						<ProgressRow fleet={progress.source === "fleet"} item={item} key={item.workId} />
					))}
				</ul>
			)}
			{progress !== undefined && failed && (
				<p className="text-sm" role="status">
					Fleet refresh failed. Displayed work is retained.
				</p>
			)}
			<a className="inline-block text-sm" href="/_board/work">
				All in Now →
			</a>
		</div>
	);
}

function ProgressRow({ fleet, item }: { readonly fleet: boolean; readonly item: Row }) {
	return (
		<li className="flex h-10 min-w-0 items-center gap-2 px-2" data-progress-id={item.workId}>
			<a className="min-w-0 flex-1 truncate text-sm" href={`/_board/item/${encodeURIComponent(item.workId)}/`} title={item.title}>
				{item.title}
			</a>
			<Badge className="border-agent-working/25 bg-agent-working/10 text-agent-working shrink-0 text-xs" variant="outline">
				{fleet ? "Fleet" : item.state}
			</Badge>
			{item.prUrl ? (
				<a aria-label={`Pull request for ${item.title}`} className="shrink-0 text-xs" href={item.prUrl}>
					PR ↗
				</a>
			) : null}
		</li>
	);
}

function unavailable(data: FleetItemsProjection | undefined) {
	if (data?.state === "unavailable") {
		return data.reason;
	}
	return "Fleet work unavailable.";
}
