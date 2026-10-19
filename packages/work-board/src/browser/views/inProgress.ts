import type { FleetItemsProjection } from "./FleetItemsProjection.ts";
import { heldPhase, workPhase } from "./workStatus.ts";

export interface ProgressRow {
	readonly prUrl?: string | undefined;
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
				.filter((item) => heldPhase(workPhase(item.stage)))
				.map((item) => ({ prUrl: item.prUrl, title: item.document?.title ?? item.workId, workId: item.workId })),
			source: "fleet",
		};
	}
	return data?.authored === undefined
		? undefined
		: { rows: data.authored.map((item) => ({ title: item.title, workId: item.workId })), source: "files" };
}
