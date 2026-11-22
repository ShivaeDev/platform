import { Effect } from "effect";
import { act } from "react";
import { activityScreenSignal, type ClientActivityState } from "@shivaedev/contract/clientActivity.ts";
import { screenDriver } from "@shivaedev/test-story/server/screenDriver.ts";
import { type ScreenSurface, screenView } from "#test-support/screenState.ts";

export const settleScreen = Effect.fnUntraced(function* (
	engine: ScreenSurface,
	tell: (line: string) => void,
	settled?: (state: ClientActivityState) => boolean,
) {
	const view = screenView(engine);
	const screen = screenDriver({
		act,
		pending: () => engine.pending?.() ?? false,
		root: view.container,
		tell,
		transport: engine.transport,
	});
	yield* screen.settle();
	for (const activity of engine.activities ?? []) {
		yield* screenDriver({ act, pending: activityScreenSignal(activity, settled), root: view.container, tell }).settle();
	}
	if ((engine.activities ?? []).length > 0) {
		yield* screen.settle();
	}
});
