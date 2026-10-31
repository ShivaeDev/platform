import { Effect, Struct } from "effect";
import { act } from "react";
import { vi } from "vitest";
import type { SearchItem } from "#client/react/searchCommands.ts";
import type { ScreenEngine } from "./screenEngine.ts";
import { screenSettles } from "./screenSettle.ts";
import { searchResultContent } from "./searchResultContent.tsx";
import { setNativeValue } from "./setNativeValue.ts";
import { accessibleOf, pressKey, shellActs, shellElement } from "./shellScreenAct.ts";

const DIALOG = "#search-dialog";
const FIELD = `${DIALOG} [role="combobox"]`;
const SEARCH_PAUSE_MS = 150;

interface SearchRow {
	readonly href: string | null | undefined;
	readonly id: string | undefined;
	readonly kind: string | undefined;
	readonly marks: readonly string[];
	readonly snippet: string | undefined;
	readonly source: string | undefined;
	readonly status: string | undefined;
	readonly title: string | undefined;
}

function rowOf(option: Element): SearchRow {
	const small = option.querySelector("small");
	return {
		href: option.querySelector("a")?.getAttribute("href"),
		id: small?.querySelector("code")?.textContent ?? undefined,
		kind: small?.firstChild?.nodeType === Node.TEXT_NODE ? (small.firstChild.textContent ?? undefined) : undefined,
		marks: [...option.querySelectorAll("p mark")].map((mark) => mark.textContent ?? ""),
		snippet: option.querySelector("p")?.textContent ?? undefined,
		source: small?.textContent ?? undefined,
		status: option.querySelector("[data-status-token]")?.textContent ?? undefined,
		title: option.querySelector("strong")?.textContent ?? undefined,
	};
}

function options() {
	return [...document.querySelectorAll('[cmdk-list] [role="option"]')];
}

function field() {
	return shellElement<HTMLInputElement>(FIELD, "search field");
}

function type(query: string) {
	act(() => {
		const input = field();
		setNativeValue(input, query);
		input.dispatchEvent(new Event("input", { bubbles: true }));
	});
}

export function shellSearchVerbs(engine: ScreenEngine, tell: (line: string) => void) {
	const { acting, reading } = shellActs(engine, tell);
	return {
		chooseResult: (title: string) =>
			acting(`the reader chooses the result ${JSON.stringify(title)}`, () => {
				const option = options().find((candidate) => candidate.querySelector("strong")?.textContent === title);
				const link = option?.querySelector("a");
				if (!link) {
					throw new Error(`Search lists no result ${title}`);
				}
				link.click();
			}),
		closeSearch: () =>
			acting("the reader closes Search with its Close button", () => {
				const close = [...document.querySelectorAll<HTMLElement>(`${DIALOG} button`)].find((button) => accessibleOf(button).name === "Close");
				if (!close) {
					throw new Error("Search has no Close button");
				}
				close.click();
			}),
		firstResult: () => reading("the reader reads the first result", () => options()[0]?.querySelector("strong")?.textContent),
		includeFleetFiles: () =>
			acting("the reader toggles Include files Fleet writes", () => shellElement(`${DIALOG} [role="checkbox"]`, "Fleet files toggle").click()),
		openSearch: () =>
			acting("the reader clicks Search in the header", () => {
				const button = shellElement("#search-open", "Search button");
				button.focus();
				button.click();
			}),
		openSearchWithShortcut: (modifier: "Ctrl" | "Cmd" = "Ctrl") =>
			acting(`the reader presses ${modifier}+K`, () => {
				pressKey(document.activeElement ?? document, "k", modifier === "Ctrl" ? { ctrlKey: true } : { metaKey: true });
			}),
		pressInFleetFilesToggle: (key: string) =>
			acting(`the reader presses ${key} on Include files Fleet writes`, () => {
				pressKey(shellElement(`${DIALOG} [role="checkbox"]`, "Fleet files toggle"), key);
			}),
		pressInSearch: (key: string) =>
			acting(`the reader presses ${key} in the search field`, () => {
				pressKey(field(), key);
			}),
		resultGroups: () =>
			reading("the reader reads the result groups and their titles", () =>
				[...document.querySelectorAll('[cmdk-list] [role="group"]')].map((group) => ({
					group: accessibleOf(group).name,
					titles: [...group.querySelectorAll('[role="option"] strong')].map((title) => title.textContent),
				})),
			),
		results: <const TField extends keyof SearchRow>(...fields: readonly TField[]) =>
			reading(`the reader reads each result's ${fields.join(", ")}`, () =>
				options().map((option) => {
					const row = rowOf(option);
					return Struct.pick(row, fields);
				}),
			),
		resultsArrive: (items: readonly SearchItem[], query = "") =>
			acting(`the palette receives ${items.length} results${query ? ` for ${JSON.stringify(query)}` : ""}`, async () => {
				if (!engine.view) {
					throw new Error("No search results are open");
				}
				await engine.view.render(searchResultContent(items, query));
			}),
		resultsLinkingTo: (href: string) =>
			reading(`the reader reads the results that link to ${href}`, () =>
				options()
					.filter((option) => option.querySelector("a")?.getAttribute("href") === href)
					.map((option) => option.querySelector("strong")?.textContent),
			),
		resultTitles: () => reading("the reader reads the result titles", () => options().map((option) => option.querySelector("strong")?.textContent)),
		retrySearch: () =>
			acting("the reader retries the search", () => {
				const retry = [...document.querySelectorAll<HTMLElement>(`${DIALOG} button`)].find((button) => button.textContent === "Retry search");
				if (!retry) {
					throw new Error("Search offers no Retry search");
				}
				retry.click();
			}),
		searchDialog: () => reading("the reader checks whether Search is open", () => (document.querySelector(DIALOG) ? "open" : "closed")),
		searchFor: (query: string) =>
			Effect.gen(function* () {
				tell(`the reader types ${JSON.stringify(query)} into Search and pauses for the palette's ${SEARCH_PAUSE_MS} ms debounce`);
				vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
				try {
					type(query);
					act(() => {
						vi.advanceTimersByTime(SEARCH_PAUSE_MS);
					});
				} finally {
					vi.useRealTimers();
				}
				yield* screenSettles(engine, tell);
			}),
		searchHints: () =>
			reading("the reader looks for keyboard hints in Search", () => {
				const dialog = document.querySelector("#search-dialog");
				return [...(dialog?.querySelectorAll("kbd") ?? [])].length > 0 || dialog?.textContent?.includes("Enter to open") ? "shown" : "none";
			}),
		searchQuery: () => reading("the reader reads the search field", () => field().value),
		searchResult: (title: string) =>
			reading(`the reader reads the result ${JSON.stringify(title)}`, () => {
				const option = options().find((candidate) => candidate.querySelector("strong")?.textContent === title);
				return option ? rowOf(option) : "missing";
			}),
		searchStatus: () => reading("the reader reads the search status", () => document.querySelector(`${DIALOG} [role="status"]`)?.textContent),
		selectedResult: () =>
			reading("the reader reads which result is selected and which one the search field announces", () => {
				const announced = field().getAttribute("aria-activedescendant");
				function title(option: Element | null | undefined) {
					return option?.querySelector("strong")?.textContent;
				}
				return {
					announced: title(announced ? document.getElementById(announced) : undefined),
					selected: title(document.querySelector(`${DIALOG} [role="option"][aria-selected="true"]`)),
				};
			}),
		typeBeforeSearchPause: (query: string) =>
			Effect.sync(() => {
				tell(`the reader types ${JSON.stringify(query)} into Search and acts before the palette's ${SEARCH_PAUSE_MS} ms debounce ends`);
				vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
				try {
					type(query);
				} finally {
					vi.useRealTimers();
				}
			}),
	};
}
