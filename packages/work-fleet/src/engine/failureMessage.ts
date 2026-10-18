import { isFleetError } from "#errors.ts";
import { BoardFailure } from "#policy.ts";
import { SessionFailure } from "#session/schema.ts";
import { StorageAdmission, StorageCapacity, StorageConflict, StorageQuota } from "#storage/errors.ts";
export function failureMessage(error: unknown): string {
	if (error instanceof StorageAdmission || isFleetError(error) || error instanceof SessionFailure || error instanceof BoardFailure) {
		return error.message;
	}
	if (error instanceof StorageQuota) {
		return "Fresh available provider quota is required";
	}
	if (error instanceof StorageCapacity) {
		return capacityMessage(error);
	}
	if (error instanceof StorageConflict) {
		return "Work changed during this observation; load the current record";
	}
	return "The integration is unavailable; inspect runtime diagnostics";
}

function capacityMessage(error: StorageCapacity) {
	switch (error.kind) {
		case "open-pull-requests":
			return `waiting for open PRs to merge: ${error.occupied ?? error.limit} of ${error.limit}`;
		case "merge-work":
			return `waiting for ${error.occupied ?? 0} review or repair launches to go first (limit ${error.limit})`;
		default:
			return `${error.kind} capacity is occupied (limit ${error.limit})`;
	}
}
