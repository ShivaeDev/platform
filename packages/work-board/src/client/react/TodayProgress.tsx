import type { FleetItemsProjection } from "#browser/views/FleetItemsProjection.ts";
import { inProgress, type ProgressRow as Row } from "#browser/views/inProgress.ts";
import { Badge } from "#client/react/components/ui/badge.tsx";
import { FleetStopped } from "./FleetStopped.tsx";

export function TodayProgress({ data, failed }: { readonly data: FleetItemsProjection | undefined; readonly failed: boolean }) {
	const progress = inProgress(data);
	const source = progress?.source === "files" ? "Task file" : "Fleet";
	return (
		<div className="space-y-3">
			{data?.state === "unavailable" && data.startCommand !== undefined ? (
				<FleetStopped command={data.startCommand} reason={data.reason}>
					{progress?.source === "files" && <p className="m-0 text-muted-foreground">Status comes from the task files, not live Fleet.</p>}
				</FleetStopped>
			) : (
				progress?.source !== "fleet" && (
					<div className="text-muted-foreground text-sm" role="status">
						<p className="m-0">{unavailable(data, failed)}</p>
						{progress?.source === "files" && <p className="m-0">Status comes from the task files, not live Fleet.</p>}
					</div>
				)
			)}
			{progress?.rows.length === 0 && (
				<p className="text-muted-foreground text-sm">
					{progress.source === "files" ? "No task file marks work in progress." : "Fleet holds no work in progress."}
				</p>
			)}
			{progress !== undefined && progress.rows.length > 0 && (
				<ul aria-label="In progress" className="m-0 list-none divide-y rounded-lg border border-border p-0" data-progress-source={progress.source}>
					{progress.rows.slice(0, 8).map((item) => (
						<ProgressRow item={item} key={item.workId} source={source} />
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

function ProgressRow({ item, source }: { readonly item: Row; readonly source: string }) {
	return (
		<li className="flex h-10 min-w-0 items-center gap-2 px-2" data-progress-id={item.workId}>
			<a className="min-w-0 flex-1 truncate text-sm" href={`/_board/item/${encodeURIComponent(item.workId)}/`} title={item.title}>
				{item.title}
			</a>
			<Badge className="shrink-0 border-agent-working/25 bg-agent-working/10 text-agent-working text-xs" variant="outline">
				{source} · {item.state}
			</Badge>
			{item.prUrl ? (
				<a aria-label={`Pull request for ${item.title}`} className="shrink-0 text-xs" href={item.prUrl}>
					PR ↗
				</a>
			) : null}
		</li>
	);
}

function unavailable(data: FleetItemsProjection | undefined, failed: boolean) {
	if (data?.state === "unavailable") {
		return `Fleet unavailable. ${data.reason}`;
	}
	return failed ? "Fleet work unavailable." : "Loading Fleet work…";
}
