import { Clock, Effect } from "effect";
import { InfoIcon } from "lucide-react";
import { useContext, useState } from "react";
import { type FleetWork, laneOf, type NowLane, nowLanes } from "#browser/views/now.ts";
import type { WorkProjection } from "#browser/views/schema.ts";
import type { State } from "#browser/views/state.ts";
import { Alert, AlertDescription } from "#client/react/components/ui/alert.tsx";
import { Badge } from "#client/react/components/ui/badge.tsx";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "#client/react/components/ui/tabs.tsx";
import { FleetItemsContext } from "#client/react/FleetItemsContext.ts";
import { useMedia } from "#client/react/useMedia.ts";
import { WorkLane } from "#client/react/WorkLane.tsx";

const DONE = nowLanes[5];

export function WorkNow({ data }: { readonly data: WorkProjection }) {
	const fleet = useContext(FleetItemsContext);
	const phone = useMedia("(max-width: 767px)");
	const ready = fleet?.state === "ready";
	const items = new Map(ready ? [...fleet.completed, ...fleet.items].map((item) => [item.workId, item] as const) : []);
	const recent = new Set(
		ready
			? fleet.completed.filter((item) => item.completedAt >= Effect.runSync(Clock.currentTimeMillis) - 604_800_000).map((item) => item.workId)
			: [],
	);
	const groups = Map.groupBy(data.rows, (item) => laneOf(item.metadata, items.get(item.id), item.fleetApproved, item.answered !== undefined));
	const lanes = nowLanes.map((lane) => ({ lane, rows: (groups.get(lane) ?? []).filter((item) => lane !== DONE || recent.has(item.id)) }));
	const lane = { fleet: items, state: data.state, virtual: data.rows.length > 200 };
	const [chosen, choose] = useState<NowLane | undefined>(undefined);
	const shown = chosen ?? lanes.find((lane) => lane.rows.length > 0)?.lane ?? nowLanes[0];
	return (
		<>
			{!ready && (
				<Alert className="mb-4" role="status">
					<InfoIcon aria-hidden="true" />
					<AlertDescription>
						Fleet is unavailable. Lanes use authored status. {fleet?.state === "unavailable" ? fleet.reason : "Fleet data has not loaded."}
					</AlertDescription>
				</Alert>
			)}
			{phone ? (
				<PhoneLanes lanes={lanes} shown={shown} {...lane} onChoose={choose} />
			) : (
				<DesktopLanes lanes={lanes} {...lane} />
			)}
		</>
	);
}

interface Lanes {
	readonly lanes: readonly { readonly lane: NowLane; readonly rows: WorkProjection["rows"] }[];
	readonly fleet: ReadonlyMap<string, FleetWork>;
	readonly state: State;
	readonly virtual: boolean;
}

function PhoneLanes({ lanes, shown, onChoose, ...lane }: Lanes & { readonly shown: NowLane; readonly onChoose: (lane: NowLane) => void }) {
	return (
		<Tabs className="work-now" onValueChange={onChoose} value={shown}>
			<TabsList aria-label="Lanes" className="w-full justify-start overflow-x-auto">
				{lanes.map(({ lane: name, rows }) => (
					<TabsTrigger className="flex-none" key={name} value={name}>
						{name}
						<Badge className="tabular-nums" variant="secondary">
							{rows.length}
						</Badge>
					</TabsTrigger>
				))}
			</TabsList>
			{lanes.map(({ lane: name, rows }) => (
				<TabsContent key={name} value={name}>
					<WorkLane collapsed={false} lane={name} rows={rows} {...lane} />
				</TabsContent>
			))}
		</Tabs>
	);
}

function DesktopLanes({ lanes, ...lane }: Lanes) {
	return (
		<div className="work-columns work-now flex items-start gap-3 overflow-x-auto pb-2">
			{lanes.map(({ lane: name, rows }) => (
				<WorkLane
					className={rows.length > 0 && name !== DONE ? "min-w-60 flex-1 basis-0" : "w-44 flex-none"}
					collapsed={name === DONE}
					key={name}
					lane={name}
					rows={rows}
					{...lane}
				/>
			))}
		</div>
	);
}
