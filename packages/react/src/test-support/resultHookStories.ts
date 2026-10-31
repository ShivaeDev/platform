import { Deferred, Effect, Exit } from "effect";
import * as Atom from "effect/reactivity/Atom";
import { createElement } from "react";
import type { Rendered } from "@shivaedev/test-story/client/react.ts";
import { storyKit } from "@shivaedev/test-story/server/storyKit.ts";
import { resultEngine } from "./resultEngine.ts";
import { QueryValue, ResultView } from "./resultViews.tsx";
import { clickButton, type Screen } from "./Screen.ts";
import { screenKit } from "./screenKit.ts";

type Mode = "query" | "action" | "overlap" | "shared";
interface State {
	readonly engine: ReturnType<typeof resultEngine>;
	root?: Rendered;
}
function root(state: State) {
	if (!state.root) {
		throw new Error("No result screen is open");
	}
	return state.root;
}
function shown(state: State, selector: string) {
	return root(state).container.querySelector(selector)?.textContent;
}
function answer(screen: Screen, state: State, result: Exit.Exit<number, string>) {
	const line = Exit.isSuccess(result) ? `the work answers ${result.value}` : "the work fails with unavailable";
	return screen.act(line, () => Effect.runPromise(Deferred.done(state.engine.gate, result)));
}
function run(screen: Screen, state: State) {
	return screen.act("click Run", () => {
		state.engine.gate = Effect.runSync(Deferred.make<number, string>());
		clickButton(root(state).container, "Run");
	});
}
function dispatch(state: State, nth: number) {
	const found = state.engine.dispatches[nth - 1];
	if (!found) {
		throw new Error(`Dispatch ${nth} has not started`);
	}
	return found;
}

export const resultHooks = storyKit(
	screenKit(
		"result hook screen",
		(): State => ({ engine: resultEngine() }),
		(state, screen) => ({
			cause: () => Effect.sync(() => shown(state, "[data-cause]")),
			data: () => Effect.sync(() => shown(state, "[data-data]")),
			dispatchAnswers: (nth: number, value: number) =>
				screen.act(`dispatch ${nth} answers ${value}`, () => Effect.runPromise(Deferred.succeed(dispatch(state, nth).answer, value))),
			dispatchOutcome: (nth: number) => Effect.sync(() => dispatch(state, nth).outcome),
			executions: () => Effect.sync(() => state.engine.calls),
			readers: () => Effect.sync(() => [...root(state).container.querySelectorAll("output")].map((output) => output.textContent)),
			run: () => run(screen, state),
			showAnotherQuery: () =>
				screen.act("show a different query that has not answered", () =>
					root(state).render(createElement(QueryValue, { atom: Atom.make(Effect.never) })),
				),
			shown: () => Effect.sync(() => shown(state, "output")),
			status: () => Effect.sync(() => shown(state, "[data-status]")),
			workFails: () => answer(screen, state, Exit.fail("unavailable")),
			workSucceeds: (value: number) => answer(screen, state, Exit.succeed(value)),
		}),
	),
);

function opened(mode: Mode, line: string) {
	return resultHooks.trait("screen", line, function* ({ screen, state }) {
		state.root = yield* screen.open(createElement(ResultView, { engine: state.engine, mode }));
	});
}

export function queryIsLoading() {
	return opened("query", "a query whose work has not answered");
}

export function queryAnswered(value: number) {
	return resultHooks.traits(
		queryIsLoading(),
		resultHooks.trait("screen", `the query's work answered ${value}`, ({ screen, state }) => answer(screen, state, Exit.succeed(value))),
	);
}

export function queryRefreshing(value: number) {
	return resultHooks.traits(
		queryAnswered(value),
		resultHooks.trait("screen", "the query refreshes, and its work has not answered", ({ screen, state }) => run(screen, state)),
	);
}

export function actionAddsFive() {
	return opened("action", "an action that adds 5 to what its work answers");
}

export function actionAnswered(value: number) {
	return resultHooks.traits(
		actionAddsFive(),
		resultHooks.trait("screen", `the action ran, and its work answered ${value}`, function* ({ screen, state }) {
			yield* run(screen, state);
			yield* answer(screen, state, Exit.succeed(value));
		}),
	);
}

export function accountQuery() {
	return resultHooks.trait("screen", "a query that answered account A", function* ({ screen, state }) {
		state.root = yield* screen.open(createElement(QueryValue, { atom: Atom.make(Effect.succeed("account A")) }));
	});
}

export function twoReadersOfOneQuery() {
	return opened("shared", "two components read one query, whose work answers how many times it ran");
}

export function oneDispatchRunning() {
	return resultHooks.traits(
		opened("overlap", "an action whose dispatches each wait for their own answer"),
		resultHooks.trait("screen", "the action is dispatched once", ({ screen, state }) => run(screen, state)),
	);
}
