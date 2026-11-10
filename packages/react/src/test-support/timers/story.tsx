import { Effect, Layer } from "effect";
import * as Clock from "effect/Clock";
import * as Atom from "effect/reactivity/Atom";
import * as AtomRegistry from "effect/reactivity/AtomRegistry";
import { act } from "react";
import { screenDriver } from "@shivaedev/test-story/server/screenDriver.ts";
import { storyKit } from "@shivaedev/test-story/server/storyKit.ts";
import { watchedClock } from "@shivaedev/test-story/server/watchedClock.ts";
import { screenPending } from "#screenPending.ts";
import { Screen } from "#test/Screen.ts";
import { View } from "#test/timers/View.tsx";

export const timersStory = storyKit({
	clock: "test",
	*create() {
		const clock = yield* watchedClock;
		const runtime = Atom.runtime(Layer.succeed(Clock.Clock, clock));
		const screen = new Screen(() => undefined);
		const selections: string[] = [];
		function onSelect() {
			selections.push("selected");
		}
		const view = yield* screen.open(<View onSelect={onSelect} runtime={runtime} />);
		const pending = yield* screenPending().pipe(Effect.provideService(AtomRegistry.AtomRegistry, view.registry));
		return { clock, onSelect, pending, runtime, screen, selections, view };
	},
	inspect: ({ view, pending }) => ({ pending: pending(), text: view.container.textContent }),
	name: "runtime timers",
	stages: [],
	verbs: ({ clock, onSelect, pending, runtime, screen, selections, view }, story) => {
		screen.tell = story.tell;
		const driver = screenDriver({ act, clock, pending, root: view.container, tell: story.tell });
		function pointer(type: string, line: string) {
			return screen.act(line, () => {
				const button = view.container.querySelector("button");
				if (button === null) {
					throw new Error("The diary row is missing");
				}
				button.dispatchEvent(new PointerEvent(type, { bubbles: true }));
			});
		}
		return {
			...driver,
			advanceNextTimer: () =>
				Effect.promise(async () => {
					story.tell("advance to the next registered timer");
					let advanced = false;
					await act(async () => {
						advanced = await Effect.runPromise(clock.advanceNext);
					});
					return advanced ? "timer ran" : "no timer";
				}),
			beginPress: () => pointer("pointerdown", "press the diary row"),
			cancelPress: () => pointer("pointercancel", "cancel the diary row press"),
			close: () => Effect.promise(() => view.render(null)),
			isBusy: () => Effect.sync(pending),
			leaveRow: () => pointer("pointerout", "leave the diary row"),
			releasePress: () => pointer("pointerup", "release the diary row"),
			results: () => Effect.sync(() => driver.text("output")),
			row: () => Effect.sync(() => driver.text("button")),
			search: (value: string) => driver.enter("input", value),
			selectionEvents: () => Effect.sync(() => [...selections]),
			setDebounce: (debounce: number) => Effect.promise(() => view.render(<View debounce={debounce} onSelect={onSelect} runtime={runtime} />)),
			setDelay: (delay: number) => Effect.promise(() => view.render(<View delay={delay} onSelect={onSelect} runtime={runtime} />)),
			timePasses: (millis: number) => screen.act(`${millis} ms pass`, () => Effect.runPromise(clock.adjust(millis))),
		};
	},
});
