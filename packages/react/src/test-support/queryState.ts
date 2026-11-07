import { Effect } from "effect";
import type * as AsyncResult from "effect/reactivity/AsyncResult";
import type * as Atom from "effect/reactivity/Atom";
import type { QueryOptions } from "#client/resultState.ts";
import { type heldReads, queryView, type Unavailable } from "#test/queryView.ts";
import type { Screen } from "#test/Screen.ts";

export interface State {
	marked?: { readonly content: Element | null; readonly shell: Element | null };
	native?: Atom.Writable<AsyncResult.AsyncResult<string, Unavailable>> | undefined;
	payload: string;
	readonly reads: ReturnType<typeof heldReads>;
	view?: Awaited<ReturnType<typeof queryView>>;
}

export function view(state: State) {
	if (!state.view) {
		throw new Error("The query screen is not open");
	}
	return state.view;
}

export function native(state: State) {
	if (!state.native) {
		throw new Error("Expected a writable native query");
	}
	return state.native;
}

export interface Engine {
	readonly screen: Screen;
	readonly state: State;
}

export function* openProbe({ screen, state }: Engine, options: QueryOptions) {
	const root = yield* screen.open();
	state.reads.next("first");
	state.view = yield* Effect.promise(() => queryView(root, state.reads.queries("first"), options));
}
