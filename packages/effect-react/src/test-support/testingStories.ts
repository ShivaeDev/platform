import { useAtomValue } from "@effect/atom-react";
import { Clock, Effect } from "effect";
import * as Atom from "effect/reactivity/Atom";
import { createElement } from "react";
import { expect } from "vitest";
import { eventually, type Rendered } from "#testing.ts";
import { NotesView } from "./NotesView.ts";
import { clickButton, screenKit } from "./screenKit.ts";

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
export const testing = screenKit(
	"render helper screen",
	(): State => ({ acquired: 0, released: 0 }),
	(state, screen) => ({
		click: () => screen.act("add Morning walk", () => clickButton(first(state).container, "Add")),
		closeFirst: () => screen.act("unmount the first screen", () => first(state).unmount()),
		closeSecond: () => screen.act("unmount the second screen", () => second(state).unmount()),
		deadlineFailure: () => {
			screen.tell("observe assertions until the three-second deadline");
			return Effect.promise(async () => {
				const started = Effect.runSync(Clock.currentTimeMillis);
				let attempts = 0;
				let lastFailure: unknown;
				const thrown = await eventually(() => {
					attempts += 1;
					try {
						expect(attempts).toBe(0);
					} catch (error) {
						lastFailure = error;
						throw error;
					}
				}).catch((error: unknown) => error);
				return { attempts, elapsed: Effect.runSync(Clock.currentTimeMillis) - started, lastFailure, thrown };
			});
		},
		*failInScope() {
			screen.tell("a mounted screen fails inside its Scope");
			const value = Atom.keepAlive(
				Atom.make((get) => {
					state.acquired += 1;
					get.addFinalizer(() => {
						state.released += 1;
					});
					return state.acquired;
				}),
			);
			const result = yield* Effect.exit(
				Effect.scoped(
					Effect.gen(function* () {
						state.first = yield* screen.open(createElement(Probe, { label: "scoped:", value }));
						return yield* Effect.fail("the screen story failed");
					}),
				),
			);
			return { acquired: state.acquired, released: state.released, result, root: first(state) };
		},
		mounts: () => ({ acquired: state.acquired, first: first(state), released: state.released, second: second(state) }),
		ready: (text: string) =>
			screen.observe(`notes show ${text} and Add is enabled`, () => {
				expect(first(state).container.querySelector("output")?.textContent).toBe(text);
				expect(first(state).container.querySelector("button")?.disabled).toBe(false);
			}),
		relabel: () =>
			screen.act("rerender the first mount", () => {
				if (!state.value) {
					throw new Error("No tracked atom");
				}
				return first(state).render(createElement(Probe, { label: "updated:", value: state.value }));
			}),
	}),
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
