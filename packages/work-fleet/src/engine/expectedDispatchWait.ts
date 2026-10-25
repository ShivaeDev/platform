import { failureContext } from "#engine/failureContext.ts";
import { StorageCapacity, StorageQuota } from "#storage/errors.ts";

export function expectedDispatchWait(error: unknown): boolean {
	return error instanceof StorageCapacity || error instanceof StorageQuota || failureContext(error).expectedWait === true;
}
