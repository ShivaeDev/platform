import { Effect } from "effect";
import { act } from "react";
import { activityScreenSignal, isClientIdle } from "@shivaedev/contract/clientActivity.ts";
import { screenDriver } from "@shivaedev/test-story/server/screenDriver.ts";
import { connected, type Screen } from "#modules/notes/test-support/screenState.ts";
import { screenView } from "#test-support/screenState.ts";

export const settleQuery = Effect.fnUntraced(function* (engine: Screen) {
	if (engine.client.listHeld()) {
		yield* Effect.promise(() => act(() => Effect.runPromise(engine.client.listWaiting())));
		return;
	}
	const view = screenView(engine);
	yield* screenDriver({
		act,
		activity: activityScreenSignal(connected(engine).activity, isClientIdle),
		root: view.container,
		tell: () => undefined,
	}).settle();
});
