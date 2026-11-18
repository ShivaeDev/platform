import { Effect, SubscriptionRef } from "effect";
import { type ClientActivityState, type ConnectionStatus, isClientSettled } from "#clientActivity.ts";

export function activityState() {
	let held = 0;
	let answered = false;
	let connection: ConnectionStatus = "live";
	const state = Effect.runSync(
		SubscriptionRef.make<ClientActivityState>({
			commands: 0,
			connectionStatus: "live",
			firstSettled: false,
			initialQueries: 0,
			liveHints: 0,
			refreshingAtoms: 0,
			rpcCalls: 0,
			unreflectedCommands: 0,
		}),
	);
	function publish() {
		const connectionStatus = held > 0 ? "waiting-for-connection" : connection;
		Effect.runSync(
			SubscriptionRef.update(state, (current) => (current.connectionStatus === connectionStatus ? current : { ...current, connectionStatus })),
		);
	}
	function latched(current: ClientActivityState): ClientActivityState {
		return answered && !current.firstSettled && isClientSettled(current) ? { ...current, firstSettled: true } : current;
	}
	return {
		activity: Object.assign(SubscriptionRef.changes(state), { current: SubscriptionRef.get(state) }),
		answered: () => {
			answered = true;
			Effect.runSync(SubscriptionRef.update(state, latched));
		},
		change: (key: Exclude<keyof ClientActivityState, "connectionStatus" | "firstSettled">, delta: number) => {
			Effect.runSync(SubscriptionRef.update(state, (current) => latched({ ...current, [key]: current[key] + delta })));
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
