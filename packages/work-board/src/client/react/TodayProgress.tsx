import type { FleetItemsProjection } from "#browser/views/FleetItemsProjection.ts";
import { Badge } from "#client/react/components/ui/badge.tsx";
import { EmptyState } from "./EmptyState.tsx";
import { FleetStopped } from "./FleetStopped.tsx";
import { inProgressItems } from "./inProgressItems.ts";
import { LoadingRows } from "./loading.tsx";

export function TodayProgress({ data, failed }: { readonly data: FleetItemsProjection | undefined; readonly failed: boolean }) {
	const items = inProgressItems(data);
	return (
		<div className="space-y-3">
			{items === undefined && data === undefined && !failed && <LoadingRows label="Loading work in progress" />}
			{data?.state === "unavailable" && data.startCommand !== undefined ? (
				<FleetStopped command={data.startCommand} reason={data.reason} />
			) : (
				items === undefined &&
				(data !== undefined || failed) && (
					<p className="text-muted-foreground text-sm" role="status">
						{unavailable(data)}
					</p>
				)
			)}
			{items?.length === 0 && <EmptyState title="No work in progress">Fleet is not working on anything right now.</EmptyState>}
			{items !== undefined && items.length > 0 && (
				<ul aria-label="In progress" className="m-0 list-none divide-y rounded-lg border border-border p-0">
					{items.slice(0, 8).map((item) => (
						<ProgressRow item={item} key={item.workId} />
					))}
				</ul>
			)}
			{items !== undefined && failed && (
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

function ProgressRow({ item }: { readonly item: NonNullable<ReturnType<typeof inProgressItems>>[number] }) {
	const title = item.document?.title ?? item.workId;
	return (
		<li className="flex h-10 min-w-0 items-center gap-2 px-2" data-progress-id={item.workId}>
			<a className="min-w-0 flex-1 truncate text-sm" href={`/_board/item/${encodeURIComponent(item.workId)}/`} title={title}>
				{title}
			</a>
			<Badge className="shrink-0 border-agent-working/25 bg-agent-working/10 text-agent-working text-xs" variant="outline">
				Fleet · {item.stage}
			</Badge>
			{item.prUrl ? (
				<a aria-label={`Pull request for ${title}`} className="shrink-0 text-xs" href={item.prUrl}>
					PR ↗
				</a>
			) : null}
		</li>
	);
}

function unavailable(data: FleetItemsProjection | undefined) {
	if (data?.state === "unavailable") {
		return `Fleet unavailable. ${data.reason}`;
	}
	return "Fleet work unavailable.";
}
