import { Effect } from "effect";
import * as AsyncResult from "effect/reactivity/AsyncResult";
import { act } from "react";
import { expect } from "vitest";
import { observeScreen } from "#test-support/screenObservations.ts";
import { type Screen, screenView } from "#test-support/screenState.ts";

export function noteScreenVerbs(engine: Screen, tell: (line: string) => void) {
	const observe = observeScreen(tell);
	return {
		cachedTitleIs: (title: string) =>
			observe(`the detail query cache holds ${JSON.stringify(title)}`, () => {
				const view = screenView(engine);
				expect(AsyncResult.getOrElse(view.registry.get(engine.client.api.get.query({ id: 1 })), () => undefined)?.title).toBe(title);
			}),
		finishWordCount: (count: number) =>
			Effect.promise(async () => {
				tell(`the worker finishes counting ${count} words`);
				await act(() => engine.client.finishNote(1, count));
			}),
		noteCallsAre: (...calls: string[]) =>
			observe(`the notes client has only been called with ${JSON.stringify(calls)}`, () => {
				expect(engine.client.calls).toEqual(calls);
			}),
		noteWasDeleted: () =>
			observe("the notes client received the delete command", () => {
				expect(engine.client.calls).toContain("delete");
			}),
		queryCountIs: (query: "get" | "list", count: number) =>
			observe(`the ${query} query has run ${count} times`, () => {
				expect(engine.client.calls.filter((call) => call === query)).toHaveLength(count);
			}),
		queryRefreshed: (query: "get" | "list", previousCount: number) =>
			observe(`the ${query} query refreshes beyond ${previousCount} calls`, () => {
				expect(engine.client.calls.filter((call) => call === query).length).toBeGreaterThan(previousCount);
			}),
		reviseNote: (title: string) =>
			Effect.promise(async () => {
				tell(`another session revises the note to ${JSON.stringify(title)} and sends a live hint`);
				await act(() => engine.client.reviseNote(1, title));
			}),
		routeIs: (route: string) =>
			observe(`the app is at ${route}`, () => {
				expect(engine.router?.state.location.pathname).toBe(route);
			}),
		visitNotes: () =>
			Effect.promise(async () => {
				tell("visit the notes list");
				if (engine.router === undefined) {
					throw new Error("The routed app is not open");
				}
				await act(() => engine.router?.navigate({ to: "/" }));
			}),
		wordCountIs: (count: number | null) =>
			observe(`the saved note shows ${count === null ? "Counting words…" : `${count} ${count === 1 ? "word" : "words"}`}`, () => {
				const text = screenView(engine).container.querySelector("tbody tr[data-state]")?.textContent;
				expect(text).toContain(count === null ? "Counting words…" : `${count} ${count === 1 ? "word" : "words"}`);
				if (count === 1) {
					expect(text).not.toContain("1 words");
				}
			}),
	};
}
