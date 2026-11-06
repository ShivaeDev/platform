import { Effect, Stream } from "effect";
import type * as Atom from "effect/reactivity/Atom";

export type ConnectionStatus = "live" | "reconnecting" | "waiting-for-connection";

export interface ClientActivityState {
	readonly commands: number;
	readonly connectionStatus: ConnectionStatus;
	readonly initialQueries: number;
	readonly liveHints: number;
	readonly liveInvalidations: number;
	readonly refreshingAtoms: number;
	readonly rpcCalls: number;
}

export type ClientActivity = Stream.Stream<ClientActivityState> & {
	readonly connectionStatus: Atom.Atom<ConnectionStatus>;
	readonly current: Effect.Effect<ClientActivityState>;
};

export const Activity = Symbol.for("@shivaedev/contract/ClientActivity");

export interface ActiveClient {
	readonly [Activity]: ClientActivity;
}

export function clientActivity(client: ActiveClient): ClientActivity {
	return client[Activity];
}

export function isClientIdle(state: ClientActivityState): boolean {
	return state.rpcCalls === 0 && state.liveInvalidations === 0 && state.refreshingAtoms === 0;
}

export function isClientSettled(state: ClientActivityState): boolean {
	return state.commands === 0 && state.initialQueries === 0;
}

export function activityScreenSignal(activity: ClientActivity, settled = isClientSettled) {
	function screenState(state: ClientActivityState) {
		return { connectionStatus: state.connectionStatus, hints: state.liveHints, pending: !settled(state) };
	}
	return Object.assign(Stream.map(activity, screenState), { current: Effect.map(activity.current, screenState) });
}
