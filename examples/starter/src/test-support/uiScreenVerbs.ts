import { Effect } from "effect";
import { act } from "react";
import { screenDriver } from "@shivaedev/test-story/server/screenDriver.ts";
import { type ScreenSurface, screenView } from "#test-support/screenState.ts";

export function uiScreenVerbs(engine: ScreenSurface, tell: (line: string) => void) {
	const driver = screenDriver({
		act: async (action) => {
			await act(action);
		},
		pending: () => false,
		root: () => screenView(engine).container,
		tell,
	});
	return {
		accessible: driver.accessible,
		clickControl: driver.click,
		controlText: driver.text,
		screenContent: () =>
			Effect.sync(() => {
				tell("read the rendered screen");
				return screenView(engine).container;
			}),
	};
}
