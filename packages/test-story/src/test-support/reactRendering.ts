import { useAtomValue } from "@effect/atom-react";
import { Deferred, Effect } from "effect";
import * as AsyncResult from "effect/reactivity/AsyncResult";
import * as Atom from "effect/reactivity/Atom";
import { act, createElement, type ReactNode } from "react";
import { vi } from "vitest";
import { expectNoReactWarnings, type Rendered, render } from "@shivaedev/test-story/client/react.ts";
import { storyKit } from "@shivaedev/test-story/server/storyKit.ts";

interface State {
	acquired: number;
	first?: Rendered;
	gate: Deferred.Deferred<string>;
	released: number;
	second?: Rendered;
	value?: Atom.Atom<number>;
}
function first(state: State) {
	if (!state.first) {
		throw new Error("No first screen");
	}
	return state.first;
}
function second(state: State) {
	if (!state.second) {
		throw new Error("No second screen");
	}
	return state.second;
}
function open(node: ReactNode) {
	return Effect.acquireRelease(
		Effect.promise(() => render(node)),
		(view) => Effect.promise(view.unmount),
	);
}
function Probe({ label, value }: { readonly label: string; readonly value: Atom.Atom<number> }) {
	return createElement("output", null, label, useAtomValue(value));
}
function ResultProbe({ value }: { readonly value: Atom.Atom<AsyncResult.AsyncResult<string>> }) {
	return createElement(
		"output",
		null,
		AsyncResult.getOrElse(useAtomValue(value), () => ""),
	);
}

Object.assign(globalThis, { "IS_REACT_ACT_ENVIRONMENT": true });
expectNoReactWarnings();

export const testing = storyKit({
	clock: "live",
	create: () => Effect.map(Deferred.make<string>(), (gate): State => ({ acquired: 0, gate, released: 0 })),
	inspect: (state) => ({ screens: [state.first, state.second].map((view) => view?.container.innerHTML) }),
	name: "React render helper",
	stages: ["screen"],
	verbs: (state, story) => {
		function run(line: string, action: () => void | Promise<void>) {
			story.tell(line);
			return Effect.promise(async () => {
				await act(action);
			});
		}
		return {
			answer: (value: string) => run(`the atom receives ${value}`, () => Effect.runPromise(Deferred.succeed(state.gate, value).pipe(Effect.asVoid))),
			closeFirst: () => run("unmount the first screen", () => first(state).unmount()),
			closeSecond: () => run("unmount the second screen", () => second(state).unmount()),
			first: () => first(state),
			relabel: () =>
				run("rerender the first mount", () => {
					if (!state.value) {
						throw new Error("No tracked atom");
					}
					return first(state).render(createElement(Probe, { label: "updated:", value: state.value }));
				}),
			resources: () => ({ acquired: state.acquired, released: state.released }),
			second: () => second(state),
			warn: () => run("React logs a warning", () => vi.mocked(console.error)("Expected warning for the helper regression")),
		};
	},
});
export function pendingResultScreen() {
	return testing.trait("screen", "a native atom awaiting a result", function* (state) {
		const value = Atom.make(Deferred.await(state.gate).pipe(Effect.flatMap((result) => Effect.succeed(result).pipe(Effect.delay("20 millis")))));
		state.first = yield* open(createElement(ResultProbe, { value }));
	});
}
export function isolatedMounts() {
	return testing.trait("screen", "two isolated roots reading the same tracked atom", function* (state) {
		const value = Atom.keepAlive(
			Atom.make((get) => {
				state.acquired += 1;
				get.addFinalizer(() => {
					state.released += 1;
				});
				return state.acquired;
			}),
		);
		state.value = value;
		state.first = yield* open(createElement(Probe, { label: "first:", value }));
		state.second = yield* open(createElement(Probe, { label: "second:", value }));
	});
}
