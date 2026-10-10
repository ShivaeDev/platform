import { FleetFailure } from "#policy.ts";
import { SessionFailure } from "#session/schema.ts";
import { StorageCapacity, StorageConflict, StorageInvalidPath, StorageOwnershipConflict, StorageQuota } from "#storage/errors.ts";
export function failureMessage(error: unknown): string {
	if (error instanceof FleetFailure || error instanceof SessionFailure) {
		return error.message;
	}
	if (error instanceof StorageQuota) {
		return "Fresh available provider quota is required";
	}
	if (error instanceof StorageCapacity) {
		return `${error.kind} capacity is occupied (limit ${error.limit})`;
	}
	if (error instanceof StorageConflict) {
		return "Work changed during this observation; load the current record";
	}
	if (error instanceof StorageOwnershipConflict) {
		return `Scope ${error.path} is reserved by ${error.owner}`;
	}
	if (error instanceof StorageInvalidPath) {
		return "Owned scope contains an invalid repository path";
	}
	return "The integration is unavailable; inspect runtime diagnostics";
}
