import type { FleetItemsProjection } from "./FleetItemsProjection.ts";
import { statusLabel } from "./statusLabel.ts";

const held = new Set(["executing", "reviewing", "repairing", "adopting"]);

export interface ProgressRow {
	readonly prUrl?: string | undefined;
	readonly state: string;
	readonly title: string;
	readonly workId: string;
}
export interface InProgress {
	readonly rows: readonly ProgressRow[];
	readonly source: "fleet" | "files";
}

export function inProgress(data: FleetItemsProjection | undefined): InProgress | undefined {
	if (data?.state === "ready") {
		return {
			rows: data.items
				.filter((item) => held.has(item.stage))
				.map((item) => ({ prUrl: item.prUrl, state: item.stage, title: item.document?.title ?? item.workId, workId: item.workId })),
			source: "fleet",
		};
	}
	return data?.authored === undefined
		? undefined
		: { rows: data.authored.map((item) => ({ state: statusLabel(item.status), title: item.title, workId: item.workId })), source: "files" };
}
