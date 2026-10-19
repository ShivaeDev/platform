import { RouterContextProvider } from "@tanstack/react-router";
import { Effect } from "effect";
import * as Atom from "effect/reactivity/Atom";
import { boardRouter } from "#client/react/boardRouter.ts";
import { HeaderHarness } from "./HeaderHarness.tsx";
import { renderBoard } from "./react.tsx";
import { trackScreen } from "./screenEngine.ts";
import { screenStory } from "./screenStory.ts";

export function headerScreen(count: number | null | undefined, updates = false) {
	return screenStory.trait("screen", "the reader opens the header controls", function* (engine) {
		const paused = updates ? Atom.make(false) : undefined;
		if (paused) {
			engine.updatesPaused = paused;
		}
		const view = yield* Effect.promise(() =>
			renderBoard({}, () => (
				<RouterContextProvider router={boardRouter()}>
					<HeaderHarness count={count} paused={paused} />
				</RouterContextProvider>
			)),
		);
		trackScreen(engine, view, (line) => engine.tell?.(line));
	});
}
