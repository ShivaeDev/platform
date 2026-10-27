import { Effect } from "effect";
import * as AsyncResult from "effect/reactivity/AsyncResult";
import * as Atom from "effect/reactivity/Atom";
import * as AtomRegistry from "effect/reactivity/AtomRegistry";
import { storyKit } from "@shivaedev/test-story/server/storyKit.ts";
import type { QueryOptions } from "#client/resultState.ts";
import { finishQuery, queryRequests, queryView, type Unavailable } from "./queryView.ts";
import { screenWarnings } from "./Screen.ts";
import { screenKit } from "./screenKit.ts";

interface State {
	native?: Atom.Writable<AsyncResult.AsyncResult<string, Unavailable>> | undefined;
	requests: ReturnType<typeof queryRequests>;
	view?: Awaited<ReturnType<typeof queryView>>;
}
function view(state: State) {
	if (!state.view) {
		throw new Error("The query screen is not open");
	}
	return state.view;
}
export const queries = storyKit(
	screenKit(
		"query screen",
		(): State => ({ requests: queryRequests() }),
		(state, screen) => ({
			click: (label: string) => screen.act(`click ${label}`, () => view(state).click(label)),
			finish: (...args: Parameters<typeof finishQuery>) => screen.act(`query responds: ${JSON.stringify(args[1])}`, () => finishQuery(...args)),
			invalidate: () => screen.act("invalidate reports", () => view(state).invalidate(state.requests.invalidation)),
			nativeResult: () => {
				if (!state.native) {
					throw new Error("Expected a writable native query");
				}
				return view(state).registry.get(state.native);
			},
			nextResponse: () => {
				screen.tell("the next query waits for a new response");
				return state.requests.next();
			},
			payload: (name: string, options?: QueryOptions) =>
				screen.act(`query payload is ${name}`, () => view(state).render(state.requests.queries(name), options)),
			query: () => ({ native: state.native, requests: state.requests, view: view(state) }),
			refresh: () => screen.act("refresh the query", () => view(state).refresh()),
			*replaceOwner() {
				screen.tell("replace the query registry owner");
				const registry = yield* Effect.acquireRelease(
					Effect.sync(() => AtomRegistry.make()),
					(owner) => Effect.promise(view(state).unmount).pipe(Effect.ensuring(Effect.sync(() => owner.dispose()))),
				);
				yield* Effect.promise(() => view(state).render(state.requests.queries("first"), { keepPreviousData: true }, registry));
			},
			setNativeResult: (result: AsyncResult.AsyncResult<string, Unavailable>) =>
				screen.act(`native query result is ${result._tag}`, () => {
					if (!state.native) {
						throw new Error("Expected a writable native query");
					}
					view(state).registry.set(state.native, result);
				}),
			type: (name: string, value: string) => screen.act(`type ${name}: ${value}`, () => view(state).type(name, value)),
		}),
	),
);
export function queryScreen(options: QueryOptions = {}, nativeSuccess?: string) {
	return queries.trait("screen", "a rendered native query", function* ({ screen, state }) {
		const root = yield* screen.open();
		state.native =
			nativeSuccess === undefined ? undefined : Atom.make<AsyncResult.AsyncResult<string, Unavailable>>(AsyncResult.success(nativeSuccess));
		state.view = yield* Effect.promise(() => queryView(root, state.native ?? state.requests.queries("first"), options));
	});
}

export function queryFeedbackScreen(defect?: Error) {
	return queries.trait("screen", "query feedback inside an application shell and error boundary", function* ({ screen, state }) {
		const root = yield* screen.open(null, defect ? { onCaughtError: screenWarnings.expectCaughtError((error) => error === defect) } : undefined);
		state.view = yield* Effect.promise(() => queryView(root, state.requests.queries("first"), {}, true));
	});
}
