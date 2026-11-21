import { Effect } from "effect";
import * as AsyncResult from "effect/reactivity/AsyncResult";
import { act } from "react";
import { activityScreenSignal } from "@shivaedev/contract/clientActivity.ts";
import { screenSync } from "@shivaedev/contract/screenSync.ts";
import { countWords } from "@shivaedev/test-story/server/answers.ts";
import { screenDriver } from "@shivaedev/test-story/server/screenDriver.ts";
import { screenActions } from "#modules/notes/test-support/screenActions.ts";
import { connected, type Screen } from "#modules/notes/test-support/screenState.ts";
import { settleQuery } from "#modules/notes/test-support/settleQuery.ts";
import { screenView } from "#test-support/screenState.ts";
import { settleScreen } from "#test-support/settleScreen.ts";

export function noteScreenVerbs(engine: Screen, tell: (line: string) => void) {
	function driver() {
		const view = screenView(engine);
		return screenDriver({
			act,
			activity: activityScreenSignal(connected(engine).activity),
			root: view.container,
			sync: screenSync(connected(engine), view.registry),
			tell,
		});
	}
	return {
		cachedTitle: () =>
			Effect.sync(
				() =>
					AsyncResult.getOrElse(screenView(engine).registry.get(connected(engine).notes.get.query({ id: 1 })), () => undefined)?.title
					?? "nothing cached",
			),
		finishWordCount: (count: number) =>
			Effect.promise(async () => {
				tell(`the worker finishes counting ${count} words`);
				await act(() => engine.client.finishNote(1, count));
			}),
		listReads: () => Effect.sync(() => countWords(engine.client.reads.list, "list read")),
		noteReads: () => Effect.sync(() => countWords(engine.client.reads.note, "note read")),
		notesReads: () => Effect.sync(() => countWords(engine.client.reads.list + engine.client.reads.note, "notes read")),
		reviseNote: (title: string) =>
			Effect.promise(async () => {
				tell(`another session revises the note to ${JSON.stringify(title)} and sends a live hint`);
				await act(() => engine.client.reviseNote(1, title));
			}),
		route: () => Effect.sync(() => engine.router?.state.location.pathname ?? "no route"),
		// A login screen renders without the app, so nothing connects and only the screen itself settles.
		settle: () =>
			engine.live === undefined
				? settleScreen(engine, tell)
				: driver()
						.settle()
						.pipe(Effect.andThen(settleScreen(engine, tell))),
		settleQuery: () => settleQuery(engine),
		startWordCount: (count: number) =>
			Effect.promise(async () => {
				tell(`the worker finishes counting ${count} words while the server read is held`);
				await act(() => engine.client.finishNote(1, count));
			}),
		submitNewNote: () => screenActions(engine, tell).submit(),
		sync: () => driver().sync(),
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
