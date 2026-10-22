import { waitingOwner } from "#attention.ts";
import type { FleetRecord } from "#model.ts";
import { waitingReason } from "#stage.ts";

export function workSummary(record: FleetRecord) {
	const owner = waitingOwner(record);
	const actor = owner === "maintainer" ? "you" : owner;
	const reason = record.stage === "waiting" ? waitingReason(record)?.replaceAll(/\s+/gu, " ").trim() : record.blocker;
	return `${record.workId} ${record.stage}${actor === undefined ? "" : ` (waiting on ${actor})`}${reason === undefined ? "" : `: ${reason}`}`;
}
