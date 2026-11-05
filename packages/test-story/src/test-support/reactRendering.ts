import { useAtomValue } from "@effect/atom-react";
import { Clock, Deferred, Effect } from "effect";
import * as AsyncResult from "effect/reactivity/AsyncResult";
import * as Atom from "effect/reactivity/Atom";
import * as AtomRegistry from "effect/reactivity/AtomRegistry";
import { act, createElement, type ReactNode } from "react";
import { vi } from "vitest";
import { expectNoReactWarnings, type Rendered, render } from "@shivaedev/test-story/client/adapters/react.ts";
import { screenDriver } from "@shivaedev/test-story/server/screenDriver.ts";
import { storyKit } from "@shivaedev/test-story/server/storyKit.ts";

interface State {
	acquired: number;
	first?: Rendered;
	gate: Deferred.Deferred<string>;
	pending?: Atom.Atom<boolean>;
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

const originalError = console.error;
export function warningRestoration() {
	return console.error === originalError && !vi.isMockFunction(console.error) ? "restored" : "still captured";
}

Object.assign(globalThis, { "IS_REACT_ACT_ENVIRONMENT": true });
expectNoReactWarnings();

export const testing = storyKit({
	clock: "test",
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
			attachment: (mount: "first" | "second") =>
				Effect.sync(() => ((mount === "first" ? first(state) : second(state)).container.isConnected ? "attached" : "detached")),
			closeFirst: () => run("unmount the first screen", () => first(state).unmount()),
			closeSecond: () => run("unmount the second screen", () => second(state).unmount()),
			registrySharing: () => Effect.sync(() => (first(state).registry === second(state).registry ? "shared" : "isolated")),
			relabel: (label: string) =>
				run("rerender the first mount", () => {
					if (!state.value) {
						throw new Error("No tracked atom");
					}
					return first(state).render(createElement(Probe, { label, value: state.value }));
				}),
			resources: () => Effect.sync(() => ({ acquired: state.acquired, released: state.released })),
			settle: () => {
				const view = first(state);
				if (!state.pending) {
					throw new Error("No pending result screen");
				}
				return screenDriver({ act, pending: AtomRegistry.toStream(view.registry, state.pending), root: view.container, tell: story.tell }).settle();
			},
			shown: (mount: "first" | "second" = "first") => Effect.sync(() => (mount === "first" ? first(state) : second(state)).container.textContent),
			storyTime: () => Clock.currentTimeMillis,
		};
	},
});
export function pendingResultScreen() {
	return testing.trait("screen", "a native atom awaiting a result", function* (state) {
		const value = Atom.make(Deferred.await(state.gate));
		state.pending = Atom.map(value, (result) => result.waiting);
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
