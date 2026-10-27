import { Effect } from "effect";
import { act } from "react";
import { screenDriver } from "@shivaedev/test-story/server/screenDriver.ts";
import { type ScreenSurface, screenView } from "#test-support/screenState.ts";

export function uiScreenVerbs(engine: ScreenSurface, tell: (line: string) => void) {
	const driver = screenDriver({
		act: async (action) => {
			await act(action);
		},
		root: () => screenView(engine).container.ownerDocument.body,
		tell,
	});
	return {
		accessible: driver.accessible,
		clickControl: driver.click,
		controlText: driver.text,
		enterControl: driver.enter,
		findControl: driver.find,
		screenContent: () =>
			Effect.sync(() => {
				tell("read the rendered screen");
				return screenView(engine).container;
			}),
		submitControl: driver.submit,
	};
}
