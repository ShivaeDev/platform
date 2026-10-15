import type { FleetItemsProjection } from "#browser/views/FleetItemsProjection.ts";

export function inProgressItems(data: FleetItemsProjection | undefined) {
	return data?.state === "ready" ? data.items.filter((item) => ["executing", "reviewing", "repairing", "adopting"].includes(item.stage)) : undefined;
}
