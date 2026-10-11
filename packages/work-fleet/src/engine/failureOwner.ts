import type { AttentionOwner } from "#attention.ts";
import { FleetFailure } from "#policy.ts";
import { StorageCapacity, StorageQuota } from "#storage/errors.ts";

export function failureOwner(error: unknown): AttentionOwner {
	if (error instanceof StorageCapacity || error instanceof StorageQuota) {
		return "automation";
	}
	return error instanceof FleetFailure ? (error.attentionOwner ?? "orchestrator") : "orchestrator";
}
