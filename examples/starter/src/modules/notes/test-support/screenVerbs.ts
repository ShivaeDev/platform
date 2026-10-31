import { Effect, Fiber } from "effect";
import * as AsyncResult from "effect/reactivity/AsyncResult";
import { act } from "react";
import { clientActivity } from "@shivaedev/contract/clientActivity.ts";
import { screenDriver } from "@shivaedev/test-story/server/screenDriver.ts";
import { screenView } from "#test-support/screenState.ts";
import { settleScreen } from "#test-support/settleScreen.ts";
import type { Screen } from "./screenState.ts";
import { settleQuery } from "./settleQuery.ts";

export function noteScreenVerbs(engine: Screen, tell: (line: string) => void) {
	function driver() {
		return screenDriver({ act, pending: clientActivity(engine.client), root: screenView(engine).container, tell });
	}
	function afterNextHint<A, E>(action: Effect.Effect<A, E>) {
		return Effect.gen(function* () {
			const hint = yield* driver()
				.nextLiveHint()
				.pipe(Effect.forkScoped({ startImmediately: true }));
			const result = yield* action;
			yield* Fiber.join(hint);
			return result;
		});
	}
	return {
		cachedTitle: () => AsyncResult.getOrElse(screenView(engine).registry.get(engine.client.api.get.query({ id: 1 })), () => undefined)?.title,
		finishWordCount: (count: number) =>
			afterNextHint(
				Effect.promise(async () => {
					tell(`the worker finishes counting ${count} words`);
					await act(() => engine.client.finishNote(1, count));
				}),
			),
		nextLiveHint: () => driver().nextLiveHint(),
		queryCount: (query: "get" | "list") => engine.client.observed.readCount(`notes.${query}`),
		reads: () => engine.client.observed.reads(),
		reviseNote: (title: string) =>
			afterNextHint(
				Effect.promise(async () => {
					tell(`another session revises the note to ${JSON.stringify(title)} and sends a live hint`);
					await act(() => engine.client.reviseNote(1, title));
				}),
			),
		route: () => engine.router?.state.location.pathname,
		settle: () =>
			driver()
				.settle()
				.pipe(Effect.andThen(settleScreen(engine, tell))),
		settleQuery: (query: "get" | "list") => settleQuery(engine, query),
		visitNotes: () =>
			Effect.promise(async () => {
				tell("visit the notes list");
				const router = engine.router;
				if (router === undefined) {
					throw new Error("The routed app is not open");
				}
				await act(() => router.navigate({ to: "/" }));
			}),
		waitForList: () => Effect.promise(() => act(() => Effect.runPromise(engine.client.listWaiting()))),
		wordCountText: () => screenView(engine).container.querySelector("tbody td a")?.closest("tr")?.textContent,
	};
}
