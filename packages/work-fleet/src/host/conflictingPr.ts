import { FleetFailure } from "#policy.ts";

export const CONFLICTING_PR_REASON = "PR conflicts with main; inspect the conflict repair before retrying or releasing this work";

export class ConflictingPr extends FleetFailure {
	readonly mainRevision: string;

	constructor(mainRevision: string) {
		super({ code: "pr-conflicting", message: CONFLICTING_PR_REASON, reason: "stale" });
		this.mainRevision = mainRevision;
	}
}
