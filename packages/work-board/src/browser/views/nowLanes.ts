import { waitsOnYou } from "#browser/document/asks.ts";
import type { RequestState } from "#browser/document/schema.ts";
import type { Metadata } from "#metadata/schema.ts";
import type { FleetItemsProjection } from "./FleetItemsProjection.ts";
import { laneOf, nowLanes } from "./now.ts";

const WEEK = 604_800_000;
export const doneLane = nowLanes[6];

interface NowRow {
	readonly answered?: unknown;
	readonly fleetApproved?: boolean | undefined;
	readonly id: string;
	readonly metadata: Metadata;
	readonly requests?: readonly RequestState[] | undefined;
}

export function laneRows<TRow extends NowRow>(rows: readonly TRow[], fleet: FleetItemsProjection | undefined, now: number) {
	const ready = fleet?.state === "ready";
	const items = new Map(ready ? [...fleet.completed, ...fleet.items].map((item) => [item.workId, item] as const) : []);
	const recent = new Set(ready ? fleet.completed.filter((item) => item.completedAt >= now - WEEK).map((item) => item.workId) : []);
	const groups = Map.groupBy(rows, (item) =>
		laneOf(item.metadata, items.get(item.id), item.fleetApproved, item.answered !== undefined, waitsOnYou(item)),
	);
	return {
		fleet: items,
		lanes: nowLanes.map((lane) => ({ lane, rows: (groups.get(lane) ?? []).filter((item) => lane !== doneLane || recent.has(item.id)) })),
	};
}

export function openLaneCount(lanes: ReturnType<typeof laneRows>["lanes"]) {
	return lanes.filter(({ lane }) => lane !== doneLane).reduce((total, { rows }) => total + rows.length, 0);
}
