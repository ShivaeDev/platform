export interface ReleaseCiRun {
	readonly conclusion: string | null;
	readonly "head_sha": string;
	readonly status: string;
}

interface ReleasePull {
	readonly headRefOid: string;
	readonly mergeQueueEntry: { readonly id: string } | null;
	readonly state: string;
}

export function releaseHoldReason(pull: ReleasePull | undefined, run?: ReleaseCiRun): string | undefined {
	if (pull?.state !== "OPEN") {
		return undefined;
	}
	if (pull.mergeQueueEntry !== null) {
		return "merge queue";
	}
	if (run?.head_sha === pull.headRefOid) {
		if (run.status === "queued" || run.status === "in_progress") {
			return `approved CI ${run.status}`;
		}
		if (run.status === "completed" && run.conclusion === "success") {
			return "CI succeeded";
		}
	}
	return undefined;
}
