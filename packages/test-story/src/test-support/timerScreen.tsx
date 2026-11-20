import { Clock, Effect, Layer } from "effect";
import * as Atom from "effect/reactivity/Atom";
import * as AtomRegistry from "effect/reactivity/AtomRegistry";
import { act } from "react";
import { screenPending } from "@shivaedev/react/screenPending.ts";
import { expectNoReactWarnings } from "#client/adapters/react.ts";
import { mountApp } from "#server/mountApp.ts";
import { screenDriver } from "#server/screenDriver.ts";
import { storyKit } from "#server/storyKit.ts";
import { watchedClock } from "#server/watchedClock.ts";
import { TimerSearch } from "#test/TimerSearch.tsx";

expectNoReactWarnings();

export const timerScreen = storyKit({
	clock: "test",
	*create() {
		Object.assign(globalThis, { "IS_REACT_ACT_ENVIRONMENT": true });
		const clock = yield* watchedClock;
		const runtime = Atom.runtime(Layer.succeed(Clock.Clock, clock));
		const view = yield* mountApp({ create: Effect.succeed(runtime), render: (owner) => <TimerSearch runtime={owner} /> });
		const pending = yield* screenPending().pipe(Effect.provideService(AtomRegistry.AtomRegistry, view.registry));
		return { clock, pending, view };
	},
	inspect: ({ view, pending }) => ({ pending: pending(), text: view.container.textContent }),
	name: "timer screen",
	stages: [],
	verbs: ({ clock, pending, view }, story) => {
		const driver = screenDriver({ act, clock, pending, root: view.container, tell: story.tell });
		return {
			...driver,
			beginPress: () =>
				Effect.promise(async () => {
					await act(() => {
						story.tell("press the diary row");
						const button = view.container.querySelector("button");
						if (button === null) {
							throw new Error("The diary row is missing");
						}
						button.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true }));
					});
				}),
			results: () => Effect.sync(() => driver.text("output")),
			row: () => Effect.sync(() => driver.text("button")),
			timePasses: (millis: number) =>
				Effect.promise(() =>
					act(async () => {
						story.tell(`${millis} ms pass`);
						await Effect.runPromise(clock.adjust(millis));
					}),
				),
		};
	},
});
