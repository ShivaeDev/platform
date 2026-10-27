import { Effect } from "effect";
import type { RootOptions } from "react-dom/client";
import { type Rendered, render } from "@shivaedev/react/client/testing.ts";

export interface ScreenSurface {
	view: Rendered | undefined;
}

export const acquireScreen = Effect.fn("ScreenStory.acquireScreen")(function* (engine: ScreenSurface, options?: RootOptions) {
	Object.assign(globalThis, { "IS_REACT_ACT_ENVIRONMENT": true });
	engine.view = yield* Effect.acquireRelease(
		Effect.promise(() => render(null, options)),
		(view) => Effect.promise(view.unmount),
	);
	return engine.view;
});

export function screenView(engine: ScreenSurface) {
	if (engine.view === undefined) {
		throw new Error("No screen is open; give the story a screen trait");
	}
	return engine.view;
}
