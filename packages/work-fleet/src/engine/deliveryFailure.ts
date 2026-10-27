import { Conflict } from "@shivaedev/errors/taxonomy.ts";
import { withFailureContext } from "./failureContext.ts";

export const MOVED_PR_HEAD_REASON = "PR head differs from the reviewed head; review the current revision before accepting delivery";
export const CONFLICTING_PR_REASON = "PR conflicts with main; inspect the conflict repair before retrying or releasing this work";

export function movedPrHead(head: string) {
	return withFailureContext(new Conflict({ message: MOVED_PR_HEAD_REASON }), { code: "pr-head-moved", head });
}

export function conflictingPr(mainRevision: string) {
	return withFailureContext(new Conflict({ message: CONFLICTING_PR_REASON }), { code: "pr-conflicting", mainRevision });
}
