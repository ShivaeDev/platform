import type { AttentionOwner } from "#attention.ts";
import { failureContext } from "#engine/failureContext.ts";
import { StorageAdmission, StorageCapacity, StorageQuota } from "#storage/errors.ts";

export function failureOwner(error: unknown): AttentionOwner {
	if (error instanceof StorageAdmission || error instanceof StorageCapacity || error instanceof StorageQuota) {
		return "automation";
	}
	return failureContext(error).attentionOwner ?? "orchestrator";
}
