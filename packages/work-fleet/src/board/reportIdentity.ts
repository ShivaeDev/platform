import { revisionOf } from "@shivaedev/work-board/responses/records.ts";
import type { BoardWork } from "#policy.ts";
import type { SessionReceipt } from "#session/schema.ts";

export function reportIdentity(work: BoardWork, receipt: SessionReceipt) {
	const provenance = { ...receipt, workRevision: work.revision };
	return { itemId: `fleet-report.${revisionOf(JSON.stringify({ workId: work.workId, ...provenance }))}`, provenance };
}
