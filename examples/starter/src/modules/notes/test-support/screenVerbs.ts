import { Effect } from "effect";
import * as AsyncResult from "effect/reactivity/AsyncResult";
import { act } from "react";
import { screenView } from "#test-support/screenState.ts";
import type { Screen } from "./screenState.ts";
import { settleQuery } from "./settleQuery.ts";

export function noteScreenVerbs(engine: Screen, tell: (line: string) => void) {
	return {
		cachedTitle: () => AsyncResult.getOrElse(screenView(engine).registry.get(engine.client.api.get.query({ id: 1 })), () => undefined)?.title,
		finishWordCount: (count: number) =>
			Effect.promise(async () => {
				tell(`the worker finishes counting ${count} words`);
				await act(() => engine.client.finishNote(1, count));
			}),
		queryCount: (query: "get" | "list") => engine.client.observed.readCount(`notes.${query}`),
		reads: () => engine.client.observed.reads(),
		reviseNote: (title: string) =>
			Effect.promise(async () => {
				tell(`another session revises the note to ${JSON.stringify(title)} and sends a live hint`);
				await act(() => engine.client.reviseNote(1, title));
			}),
		route: () => engine.router?.state.location.pathname,
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
		watchHints: () => engine.client.observed.watchHints(),
		wordCountText: () => screenView(engine).container.querySelector("tbody td a")?.closest("tr")?.textContent,
	};
}
