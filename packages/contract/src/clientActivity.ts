import type { Effect, Stream } from "effect";

export interface ClientActivityState {
	readonly liveHints: number;
	readonly liveInvalidations: number;
	readonly refreshingAtoms: number;
	readonly rpcCalls: number;
}

export type ClientActivity = Stream.Stream<ClientActivityState> & { readonly current: Effect.Effect<ClientActivityState> };

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
