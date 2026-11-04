import { Effect } from "effect";
import * as AsyncResult from "effect/reactivity/AsyncResult";
import * as Atom from "effect/reactivity/Atom";
import { native } from "./queryState.ts";
import { queryStories } from "./queryStories.ts";
import { queryVerbs } from "./queryVerbs.ts";
import { queryView, type Unavailable } from "./queryView.ts";

export function nativeQueryAnswered(answer: string) {
	return queryStories.trait("screen", `a native query showed its answer ${answer}`, function* ({ screen, state }) {
		const root = yield* screen.open();
		state.native = Atom.make<AsyncResult.AsyncResult<string, Unavailable>>(AsyncResult.success(answer));
		state.view = yield* Effect.promise(() => queryView(root, native(state)));
	});
}

export function nativeQueryRefreshing(answer: string) {
	return queryStories.trait("screen", `a native query showed ${answer} and started a refresh that dropped it`, function* (engine) {
		const { screen, state } = engine;
		const root = yield* screen.open();
		state.native = Atom.make<AsyncResult.AsyncResult<string, Unavailable>>(AsyncResult.success(answer));
		state.view = yield* Effect.promise(() => queryView(root, native(state)));
		yield* queryVerbs(state, screen).nativeRefreshDropsAnswer();
	});
}
