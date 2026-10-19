import { Clock, Effect } from "effect";
import { InfoIcon } from "lucide-react";
import { useContext, useState } from "react";
import type { FleetItemsProjection } from "#browser/views/FleetItemsProjection.ts";
import { type FleetWork, type NowLane, nowLanes } from "#browser/views/now.ts";
import { doneLane, laneRows } from "#browser/views/nowLanes.ts";
import type { WorkProjection } from "#browser/views/schema.ts";
import type { State } from "#browser/views/state.ts";
import { Alert, AlertDescription } from "#client/react/components/ui/alert.tsx";
import { Badge } from "#client/react/components/ui/badge.tsx";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "#client/react/components/ui/tabs.tsx";
import { FleetItemsContext } from "#client/react/FleetItemsContext.ts";
import { FleetStartHelp } from "#client/react/FleetStopped.tsx";
import { useMedia } from "#client/react/useMedia.ts";
import { WorkLane } from "#client/react/WorkLane.tsx";

export function WorkNow({ data }: { readonly data: WorkProjection }) {
	const fleet = useContext(FleetItemsContext);
	const phone = useMedia("(max-width: 767px)");
	const ready = fleet?.state === "ready";
	const { fleet: items, lanes } = laneRows(data.rows, fleet, Effect.runSync(Clock.currentTimeMillis));
	const shared = { done: ready ? undefined : "Needs Fleet to show finished work.", fleet: items, state: data.state, virtual: data.rows.length > 200 };
	const [chosen, setChosen] = useState<NowLane | undefined>(undefined);
	const shown = chosen ?? lanes.find(({ rows }) => rows.length > 0)?.lane ?? nowLanes[0];
	return (
		<>
			{fleet?.state !== "ready" && <FleetNotice fleet={fleet} />}
			{phone ? <PhoneLanes lanes={lanes} shown={shown} {...shared} onChoose={setChosen} /> : <DesktopLanes lanes={lanes} {...shared} />}
		</>
	);
}

function FleetNotice({ fleet }: { readonly fleet: Extract<FleetItemsProjection, { state: "unavailable" }> | undefined }) {
	return (
		<Alert className="mb-4" role="status">
			<InfoIcon aria-hidden="true" />
			<AlertDescription>
				Lanes show the status written in each file. {fleet?.reason ?? "Fleet data has not loaded."}
				{fleet?.startCommand !== undefined && (
					<div className="mt-2">
						<FleetStartHelp command={fleet.startCommand} />
					</div>
				)}
			</AlertDescription>
		</Alert>
	);
}

interface Lanes {
	readonly done: string | undefined;
	readonly fleet: ReadonlyMap<string, FleetWork>;
	readonly lanes: readonly { readonly lane: NowLane; readonly rows: WorkProjection["rows"] }[];
	readonly state: State;
	readonly virtual: boolean;
}

function PhoneLanes({ lanes, shown, onChoose, done, ...lane }: Lanes & { readonly shown: NowLane; readonly onChoose: (lane: NowLane) => void }) {
	return (
		<Tabs className="work-now" onValueChange={onChoose} value={shown}>
			<TabsList aria-label="Lanes" className="w-full justify-start overflow-x-auto">
				{lanes.map(({ lane: name, rows }) => (
					<LaneTab count={name === doneLane && done !== undefined ? undefined : rows.length} key={name} lane={name} />
				))}
			</TabsList>
			{lanes.map(({ lane: name, rows }) => (
				<TabsContent key={name} value={name}>
					<WorkLane collapsed={false} lane={name} rows={rows} unavailable={name === doneLane ? done : undefined} {...lane} />
				</TabsContent>
			))}
		</Tabs>
	);
}

function LaneTab({ lane, count }: { readonly lane: NowLane; readonly count: number | undefined }) {
	return (
		<TabsTrigger className="flex-none" value={lane}>
			{lane}
			{count !== undefined && (
				<Badge className="tabular-nums" variant="secondary">
					{count}
				</Badge>
			)}
		</TabsTrigger>
	);
}

function DesktopLanes({ lanes, done, ...lane }: Lanes) {
	const finished = lanes.find(({ lane: name }) => name === doneLane);
	return (
		<div className="work-now grid gap-2">
			<div className="work-columns flex items-start gap-3 overflow-x-auto pb-2">
				{lanes
					.filter(({ lane: name }) => name !== doneLane)
					.map(({ lane: name, rows }) => (
						<WorkLane
							bounded
							className={rows.length > 0 ? "min-w-44 flex-[2] basis-0" : "min-w-28 flex-1 basis-0"}
							collapsed={false}
							key={name}
							lane={name}
							rows={rows}
							{...lane}
						/>
					))}
			</div>
			{finished && <WorkLane collapsed lane={finished.lane} rows={finished.rows} unavailable={done} {...lane} />}
		</div>
	);
}
