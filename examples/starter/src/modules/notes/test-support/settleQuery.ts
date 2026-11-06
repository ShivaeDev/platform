import { Effect } from "effect";
import { act } from "react";
import { activityScreenSignal, clientActivity, isClientIdle } from "@shivaedev/contract/clientActivity.ts";
import { screenDriver } from "@shivaedev/test-story/server/screenDriver.ts";
import { screenView } from "#test-support/screenState.ts";
import type { Screen } from "./screenState.ts";

export const settleQuery = Effect.fnUntraced(function* (engine: Screen) {
	if (engine.client.listHeld()) {
		yield* Effect.promise(() => act(() => Effect.runPromise(engine.client.listWaiting())));
		return;
	}
	const view = screenView(engine);
	yield* screenDriver({
		act,
		activity: activityScreenSignal(clientActivity(engine.client), isClientIdle),
		root: view.container,
		tell: () => undefined,
	}).settle();
});
