import { Effect, SubscriptionRef } from "effect";
import type { ClientActivityState, ConnectionStatus } from "#clientActivity.ts";

export function activityState() {
	let held = 0;
	let connection: ConnectionStatus = "live";
	const state = Effect.runSync(
		SubscriptionRef.make<ClientActivityState>({ connectionStatus: "live", liveHints: 0, liveInvalidations: 0, refreshingAtoms: 0, rpcCalls: 0 }),
	);
	function publish() {
		const connectionStatus = held > 0 ? "waiting-for-connection" : connection;
		Effect.runSync(
			SubscriptionRef.update(state, (current) => (current.connectionStatus === connectionStatus ? current : { ...current, connectionStatus })),
		);
	}
	return {
		activity: Object.assign(SubscriptionRef.changes(state), { current: SubscriptionRef.get(state) }),
		change: (key: Exclude<keyof ClientActivityState, "connectionStatus">, delta: number) => {
			Effect.runSync(SubscriptionRef.update(state, (current) => ({ ...current, [key]: current[key] + delta })));
		},
		hold: () => {
			held += 1;
			publish();
			return () => {
				held -= 1;
				publish();
			};
		},
		setConnection: (connectionStatus: ConnectionStatus) => {
			connection = connectionStatus;
			publish();
		},
	};
}
