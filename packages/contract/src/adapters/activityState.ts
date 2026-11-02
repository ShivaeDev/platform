import { Effect, SubscriptionRef } from "effect";
import type { ClientActivityState } from "#clientActivity.ts";

export function activityState() {
	const state = Effect.runSync(SubscriptionRef.make<ClientActivityState>({ liveHints: 0, liveInvalidations: 0, refreshingAtoms: 0, rpcCalls: 0 }));
	return {
		activity: Object.assign(SubscriptionRef.changes(state), { current: SubscriptionRef.get(state) }),
		change: (key: keyof ClientActivityState, delta: number) => {
			Effect.runSync(SubscriptionRef.update(state, (current) => ({ ...current, [key]: current[key] + delta })));
		},
	};
}
