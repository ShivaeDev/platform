import { WatchError } from "#model.ts";

export function failure(cause: unknown) {
	return new WatchError({ message: cause instanceof Error ? cause.message : "State file operation failed", reason: "state" }, { cause });
}
