import { useAtomValue } from "@effect/atom-react";
import * as Atom from "effect/reactivity/Atom";
import { createElement } from "react";
import { vi } from "vitest";
import { storyKit } from "@shivaedev/test-story/storyKit.ts";
import type { Rendered } from "#testing.ts";
import { NotesView } from "./NotesView.ts";
import { clickButton } from "./Screen.ts";
import { screenKit } from "./screenKit.ts";

interface State {
	acquired: number;
	first?: Rendered;
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
function Probe({ label, value }: { readonly label: string; readonly value: Atom.Atom<number> }) {
	return createElement("output", null, label, useAtomValue(value));
}
export const testing = storyKit(
	screenKit(
		"render helper screen",
		(): State => ({ acquired: 0, released: 0 }),
		(state, screen) => ({
			click: () => screen.act("add Morning walk", () => clickButton(first(state).container, "Add")),
			closeFirst: () => screen.act("unmount the first screen", () => first(state).unmount()),
			closeSecond: () => screen.act("unmount the second screen", () => second(state).unmount()),
			first: () => first(state),
			relabel: () =>
				screen.act("rerender the first mount", () => {
					if (!state.value) {
						throw new Error("No tracked atom");
					}
					return first(state).render(createElement(Probe, { label: "updated:", value: state.value }));
				}),
			resources: () => ({ acquired: state.acquired, released: state.released }),
			second: () => second(state),
			warn: () => screen.act("React logs a warning", () => vi.mocked(console.error)("Expected warning for the helper regression")),
		}),
	),
);
export function notesScreen() {
	return testing.trait("screen", "a query and command through a native RPC test layer", function* ({ screen, state }) {
		state.first = yield* screen.open(createElement(NotesView));
	});
}
export function isolatedMounts() {
	return testing.trait("screen", "two isolated roots reading the same tracked atom", function* ({ screen, state }) {
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
		state.first = yield* screen.open(createElement(Probe, { label: "first:", value }));
		state.second = yield* screen.open(createElement(Probe, { label: "second:", value }));
	});
}
