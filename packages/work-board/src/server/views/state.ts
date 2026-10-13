import { fieldFilter as filter, stateOf as readState, viewUrl as urlOf, State as ViewState } from "#browser/views/state.ts";
export const State = ViewState;
export type State = typeof State.Type;
export function stateOf(url: string): State {
	return readState(url);
}
export function viewUrl(state: State, changes: Partial<State> = {}, hash = ""): string {
	return urlOf(state, changes, hash);
}
export function fieldFilter(value: string | undefined): string {
	return filter(value);
}
