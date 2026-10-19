import { Clock, Effect } from "effect";
import { InfoIcon } from "lucide-react";
import { useContext, useState } from "react";
import { type FleetWork, type NowLane, nowLanes } from "#browser/views/now.ts";
import { doneLane, laneRows } from "#browser/views/nowLanes.ts";
import type { WorkProjection } from "#browser/views/schema.ts";
import type { State } from "#browser/views/state.ts";
import { Alert, AlertDescription } from "#client/react/components/ui/alert.tsx";
import { Badge } from "#client/react/components/ui/badge.tsx";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "#client/react/components/ui/tabs.tsx";
import { FleetItemsContext } from "#client/react/FleetItemsContext.ts";
import { useMedia } from "#client/react/useMedia.ts";
import { WorkLane } from "#client/react/WorkLane.tsx";

export function WorkNow({ data }: { readonly data: WorkProjection }) {
	const fleet = useContext(FleetItemsContext);
	const phone = useMedia("(max-width: 767px)");
	const ready = fleet?.state === "ready";
	const { fleet: items, lanes } = laneRows(data.rows, fleet, Effect.runSync(Clock.currentTimeMillis));
	const shared = { fleet: items, state: data.state, virtual: data.rows.length > 200 };
	const [chosen, setChosen] = useState<NowLane | undefined>(undefined);
	const shown = chosen ?? lanes.find(({ rows }) => rows.length > 0)?.lane ?? nowLanes[0];
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
			{phone ? <PhoneLanes lanes={lanes} shown={shown} {...shared} onChoose={setChosen} /> : <DesktopLanes lanes={lanes} {...shared} />}
		</>
	);
}

interface Lanes {
	readonly fleet: ReadonlyMap<string, FleetWork>;
	readonly lanes: readonly { readonly lane: NowLane; readonly rows: WorkProjection["rows"] }[];
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
	const done = lanes.find(({ lane: name }) => name === doneLane);
	return (
		<div className="work-now grid gap-2">
			<div className="work-columns flex items-start gap-3 overflow-x-auto pb-2">
				{lanes
					.filter(({ lane: name }) => name !== doneLane)
					.map(({ lane: name, rows }) => (
						<WorkLane
							className={rows.length > 0 ? "min-w-44 flex-[2] basis-0" : "min-w-28 flex-1 basis-0"}
							collapsed={false}
							key={name}
							lane={name}
							rows={rows}
							{...lane}
						/>
					))}
			</div>
			{done && <WorkLane collapsed lane={done.lane} rows={done.rows} {...lane} />}
		</div>
	);
}
