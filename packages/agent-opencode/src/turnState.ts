import type { Deferred } from "effect";
import type { BackendFailure } from "@shivaedev/agent/failures.ts";
import { opencodeFailure } from "#failure.ts";
export interface PendingText {
	readonly accepted: Deferred.Deferred<void, BackendFailure>;
	readonly text: string;
}
export interface OpenTurnState {
	readonly "_tag": "open";
	readonly pending: readonly PendingText[];
	readonly running: boolean;
}
interface ClosedTurnState {
	readonly "_tag": "closed";
}
export type TurnState = ClosedTurnState | OpenTurnState;
export const closed: ClosedTurnState = { "_tag": "closed" };
export const idle: OpenTurnState = {
	"_tag": "open",
	pending: [],
	running: false,
};
export const SESSION_CLOSED = opencodeFailure("session closed before delivery reached the provider");
export function withPending(state: OpenTurnState, text: PendingText): OpenTurnState {
	return { ...state, pending: [...state.pending, text] };
}
export function running(state: OpenTurnState): OpenTurnState {
	return {
		...state,
		running: true,
	};
}
export function rested(state: OpenTurnState): OpenTurnState {
	return {
		...state,
		running: false,
	};
}
export function sent(state: TurnState): TurnState {
	return state._tag === "closed" ? state : { ...state, pending: state.pending.slice(1) };
}
