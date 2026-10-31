import { Effect } from "effect";
import { act } from "react";
import { clientActivity } from "@shivaedev/contract/clientActivity.ts";
import { screenDriver } from "@shivaedev/test-story/server/screenDriver.ts";
import { screenView } from "#test-support/screenState.ts";
import type { Screen } from "./screenState.ts";

export const settleQuery = Effect.fnUntraced(function* (engine: Screen, _query: "get" | "list") {
	if (engine.client.listHeld()) {
		yield* Effect.promise(() => act(() => Effect.runPromise(engine.client.listWaiting())));
		return;
	}
	const view = screenView(engine);
	yield* screenDriver({ act, pending: clientActivity(engine.client), root: view.container, tell: () => undefined }).settle();
});
