import { Effect, Fiber } from "effect";
import * as AsyncResult from "effect/reactivity/AsyncResult";
import { act } from "react";
import { activityScreenSignal, clientActivity, isClientIdle } from "@shivaedev/contract/clientActivity.ts";
import { countWords } from "@shivaedev/test-story/server/answers.ts";
import { screenDriver } from "@shivaedev/test-story/server/screenDriver.ts";
import { screenView } from "#test-support/screenState.ts";
import { settleScreen } from "#test-support/settleScreen.ts";
import type { Screen } from "./screenState.ts";
import { settleQuery } from "./settleQuery.ts";

export function noteScreenVerbs(engine: Screen, tell: (line: string) => void) {
	function driver(settled?: typeof isClientIdle) {
		return screenDriver({ act, activity: activityScreenSignal(clientActivity(engine.client), settled), root: screenView(engine).container, tell });
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
		cachedTitle: () =>
			Effect.sync(
				() =>
					AsyncResult.getOrElse(screenView(engine).registry.get(engine.client.api.get.query({ id: 1 })), () => undefined)?.title ?? "nothing cached",
			),
		finishWordCount: (count: number) =>
			afterNextHint(
				Effect.promise(async () => {
					tell(`the worker finishes counting ${count} words`);
					await act(() => engine.client.finishNote(1, count));
				}),
			),
		listReads: () => Effect.sync(() => countWords(engine.client.reads.list, "list read")),
		noteReads: () => Effect.sync(() => countWords(engine.client.reads.note, "note read")),
		notesReads: () => Effect.sync(() => countWords(engine.client.reads.list + engine.client.reads.note, "notes read")),
		reviseNote: (title: string) =>
			afterNextHint(
				Effect.promise(async () => {
					tell(`another session revises the note to ${JSON.stringify(title)} and sends a live hint`);
					await act(() => engine.client.reviseNote(1, title));
				}),
			),
		route: () => Effect.sync(() => engine.router?.state.location.pathname ?? "no route"),
		settle: () =>
			driver()
				.settle()
				.pipe(Effect.andThen(settleScreen(engine, tell))),
		settleLiveChange: () => driver(isClientIdle).settle(),
		settleQuery: () => settleQuery(engine),
		startWordCount: (count: number) =>
			Effect.promise(async () => {
				tell(`the worker finishes counting ${count} words while the server read is held`);
				await act(() => engine.client.finishNote(1, count));
			}),
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
	};
}
