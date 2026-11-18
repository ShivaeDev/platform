import type { SubscriptionHint } from "#liveHintQueue.ts";
import type { QueryUpdate } from "#queryUpdate.ts";

// A token alone changed nothing the stream reads, so it is confirmed without rechecking the session or the policy.
export function carriesOnlyTokens(hint: SubscriptionHint): boolean {
	return hint._tag === "Changed" && hint.keys.length === 0;
}

// A stream of a client that named itself opens every full read with Syncing and closes every round with the tokens it passed.
export function syncFrames(syncing: boolean, hint: SubscriptionHint, updates: readonly QueryUpdate[]): readonly QueryUpdate[] {
	if (!syncing) {
		return updates;
	}
	return [
		...(hint._tag === "Resync" ? [{ _tag: "Syncing" } as const] : []),
		...updates,
		...(hint.synced === undefined ? [] : [{ _tag: "Synced", ids: hint.synced } as const]),
	];
}
