import { FleetFailure } from "#policy.ts";

export const MOVED_PR_HEAD_REASON = "PR head differs from the reviewed head; review the current revision before accepting delivery";

export class MovedPrHead extends FleetFailure {
	readonly head: string;

	constructor(head: string) {
		super({ code: "pr-head-moved", message: MOVED_PR_HEAD_REASON, reason: "stale" });
		this.head = head;
	}
}
