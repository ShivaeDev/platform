import { Effect } from "effect";
import * as AtomRegistry from "effect/reactivity/AtomRegistry";
import { act } from "react";
import { screenDriver } from "@shivaedev/test-story/server/screenDriver.ts";
import { screenView } from "#test-support/screenState.ts";
import type { Screen } from "./screenState.ts";

export const settleQuery = Effect.fnUntraced(function* (engine: Screen, query: "get" | "list") {
	const view = screenView(engine);
	yield* screenDriver({
		act,
		pending: () => engine.client.observed.readCount(`notes.${query}`) === 0,
		root: view.container,
		tell: () => undefined,
	}).settle();
	if (!engine.client.listHeld()) {
		const completed =
			query === "get"
				? AtomRegistry.getResult(view.registry, engine.client.api.get.query({ id: 1 }), { suspendOnWaiting: true }).pipe(Effect.asVoid)
				: AtomRegistry.getResult(view.registry, engine.client.api.list.query(), { suspendOnWaiting: true }).pipe(Effect.asVoid);
		yield* Effect.promise(async () => {
			await act(async () => {
				await Effect.runPromise(completed);
			});
		});
	}
});
