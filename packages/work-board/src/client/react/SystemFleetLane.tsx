import type { FleetItemsProjection } from "#browser/views/FleetItemsProjection.ts";
import { fleetHolder, stageTime } from "#browser/views/now.ts";
import { Badge } from "#client/react/components/ui/badge.tsx";
import { Card, CardContent, CardHeader, CardTitle } from "#client/react/components/ui/card.tsx";
import { EmptyState } from "./EmptyState.tsx";
import { LoadingRows } from "./loading.tsx";

export function SystemFleetLane({ data }: { readonly data: FleetItemsProjection | undefined }) {
	const items = data?.state === "ready" ? data.items.filter((item) => !["completed", "released"].includes(item.stage)) : undefined;
	return (
		<article aria-label="Fleet work" className="min-w-0">
			<Card>
				<CardHeader>
					<CardTitle>
						<h2 className="text-lg">Fleet work</h2>
					</CardTitle>
				</CardHeader>
				<CardContent>
					<FleetItems data={data} items={items} />
				</CardContent>
			</Card>
		</article>
	);
}

function FleetItems({ data, items }: { readonly data: FleetItemsProjection | undefined; readonly items: readonly Item[] | undefined }) {
	if (data?.state === "unavailable") {
		return <p role="status">Fleet work unavailable. {data.reason}</p>;
	}
	if (items === undefined) {
		return <LoadingRows framed={false} label="Loading Fleet work" />;
	}
	if (items.length === 0) {
		return <EmptyState title="No Fleet work">Fleet is not running or holding any work right now.</EmptyState>;
	}
	return (
		<ul className="m-0 list-none divide-y p-0">
			{items.map((item) => (
				<FleetRow item={item} key={item.workId} />
			))}
		</ul>
	);
}

type Item = Extract<FleetItemsProjection, { readonly state: "ready" }>["items"][number];
function FleetRow({ item }: { readonly item: Item }) {
	const title = item.document?.title ?? item.workId;
	return (
		<li className="flex min-w-0 flex-wrap items-center gap-2 py-3" data-fleet-id={item.workId}>
			<a className="min-w-0 flex-1 basis-40 font-medium text-sm [overflow-wrap:anywhere]" href={`/_board/item/${encodeURIComponent(item.workId)}/`}>
				{title}
			</a>
			<Badge variant="outline">{stageTime(item.stage).label}</Badge>
			<span className="text-muted-foreground text-xs">{fleetHolder(item)}</span>
			{Boolean(item.prUrl) && (
				<a aria-label={`Pull request for ${title}`} className="text-sm underline" href={item.prUrl}>
					PR ↗
				</a>
			)}
		</li>
	);
}
