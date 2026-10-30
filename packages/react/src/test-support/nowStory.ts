import { Clock, Effect, Layer } from "effect";
import * as Atom from "effect/reactivity/Atom";
import { TestClock } from "effect/testing";
import { createElement } from "react";
import { storyKit } from "@shivaedev/test-story/server/storyKit.ts";
import { useNow } from "#client/useNow.ts";
import { Screen } from "#test/Screen.ts";

const INTERVAL = 1000;

function Time({ runtime }: { readonly runtime: Atom.AtomRuntime<never> }) {
	return createElement("output", null, String(useNow(INTERVAL, runtime)));
}

export const nowStory = storyKit({
	*create() {
		yield* TestClock.setTime(123_000);
		const clock = yield* Clock.Clock;
		const run = Effect.runPromiseWith(yield* Effect.context());
		const screen = new Screen(() => undefined);
		const runtime = Atom.runtime(Layer.succeed(Clock.Clock, clock));
		const view = yield* screen.open(createElement(Time, { runtime }));
		return { run, screen, view };
	},
	inspect: ({ view }) => ({ time: view.container.textContent }),
	name: "component clock",
	stages: ["screen"],
	verbs: ({ run, screen, view }, story) => {
		screen.tell = story.tell;
		return {
			intervalsPass: (count: number) => screen.act(`${count} intervals of ${INTERVAL} ms pass`, () => run(TestClock.adjust(count * INTERVAL))),
			shownTime: () => Effect.sync(() => view.container.textContent),
		};
	},
});
