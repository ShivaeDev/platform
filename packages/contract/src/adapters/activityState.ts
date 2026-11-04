import { Effect, SubscriptionRef } from "effect";
import type { ClientActivityState, ConnectionStatus } from "#clientActivity.ts";

export function activityState() {
	const state = Effect.runSync(
		SubscriptionRef.make<ClientActivityState>({ connectionStatus: "live", liveHints: 0, liveInvalidations: 0, refreshingAtoms: 0, rpcCalls: 0 }),
	);
	return {
		activity: Object.assign(SubscriptionRef.changes(state), { current: SubscriptionRef.get(state) }),
		change: (key: Exclude<keyof ClientActivityState, "connectionStatus">, delta: number) => {
			Effect.runSync(SubscriptionRef.update(state, (current) => ({ ...current, [key]: current[key] + delta })));
		},
		setConnection: (connectionStatus: ConnectionStatus) => {
			Effect.runSync(
				SubscriptionRef.update(state, (current) => (current.connectionStatus === connectionStatus ? current : { ...current, connectionStatus })),
			);
		},
	};
}
