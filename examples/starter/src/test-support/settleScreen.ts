import { Effect } from "effect";
import { act } from "react";
import { activityScreenSignal } from "@shivaedev/contract/clientActivity.ts";
import { screenDriver } from "@shivaedev/test-story/server/screenDriver.ts";
import { type ScreenSurface, screenView } from "#test-support/screenState.ts";

export const settleScreen = Effect.fnUntraced(function* (engine: ScreenSurface, tell: (line: string) => void) {
	const view = screenView(engine);
	const screen = screenDriver({
		act,
		pending: () => engine.pending?.() ?? false,
		root: view.container,
		tell,
		transport: engine.transport,
	});
	yield* screen.settle();
	if (engine.activity !== undefined) {
		yield* screenDriver({ act, pending: activityScreenSignal(engine.activity), root: view.container, tell }).settle();
		yield* screen.settle();
	}
});
