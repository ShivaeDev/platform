import type { FleetItemsProjection } from "#browser/views/FleetItemsProjection.ts";
import { Badge } from "#client/react/components/ui/Badge.tsx";
import { Card } from "#client/react/components/ui/Card.tsx";

export function SystemFleetLane({ data }: { readonly data: FleetItemsProjection | undefined }) {
	const items = data?.state === "ready" ? data.items.filter((item) => !["completed", "released"].includes(item.stage)) : undefined;
	return (
		<Card aria-label="Fleet work" className="min-w-0 space-y-4">
			<h2 className="font-semibold text-lg">Fleet work</h2>
			{items === undefined && <p role="status">{data?.state === "unavailable" ? `Fleet work unavailable. ${data.reason}` : "Loading Fleet work…"}</p>}
			{items?.length === 0 && <p className="text-muted-foreground text-sm">No running or waiting Fleet work.</p>}
			{items && items.length > 0 && (
				<ul className="m-0 list-none divide-y p-0">
					{items.map((item) => (
						<FleetRow item={item} key={item.workId} />
					))}
				</ul>
			)}
		</Card>
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
			<Badge variant="outline">{item.stage}</Badge>
			{Boolean(item.attentionOwner) && <span className="text-muted-foreground text-xs">Waiting on {item.attentionOwner}</span>}
			{Boolean(item.prUrl) && (
				<a aria-label={`Pull request for ${title}`} className="text-sm underline" href={item.prUrl}>
					PR ↗
				</a>
			)}
		</li>
	);
}
