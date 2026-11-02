import { screenDriver } from "@shivaedev/test-story/server/screenDriver.ts";
import type { ScreenEngine } from "./screenEngine.ts";

export function screenObservations(engine: ScreenEngine, tell: (line: string) => void) {
	function root() {
		return engine.container ?? engine.view?.container ?? document;
	}
	const { accessible } = screenDriver({ root: () => document.body, tell });
	function element<TTag extends keyof HTMLElementTagNameMap>(selector: TTag, within?: ParentNode | null): HTMLElementTagNameMap[TTag] | null;
	function element<E extends Element = HTMLElement>(selector: string, within?: ParentNode | null): E | null;
	function element<E extends Element = HTMLElement>(selector: string, within: ParentNode | null = root()) {
		tell(`the reader finds ${selector}`);
		return within?.querySelector<E>(selector) ?? null;
	}
	function elements<TTag extends keyof HTMLElementTagNameMap>(selector: TTag, within?: ParentNode | null): HTMLElementTagNameMap[TTag][];
	function elements<E extends Element = HTMLElement>(selector: string, within?: ParentNode | null): E[];
	function elements<E extends Element = HTMLElement>(selector: string, within: ParentNode | null = root()) {
		tell(`the reader reads the matching ${selector} elements`);
		return [...(within?.querySelectorAll<E>(selector) ?? [])];
	}
	return {
		accessible,
		answeredRows: () => {
			tell("the reader reads the Answered list on Today");
			return elements("ul[aria-label='Answered'] > li").map((row) => [
				row.querySelector("a")?.textContent,
				row.querySelector("p")?.getAttribute("title"),
			]);
		},
		count: (selector: string, within?: ParentNode | null) => elements(selector, within).length,
		location: () => {
			tell("the reader reads the current route");
			return engine.router?.state.location;
		},
		readText: (selector?: string, within?: ParentNode | null) => {
			tell(`the reader reads ${selector ?? "the screen"}`);
			return selector ? element(selector, within)?.textContent : root().textContent;
		},
		readTitle: () => {
			tell("the reader reads the browser title");
			return document.title;
		},
		referenceMarkup: () => {
			tell("the reader reads the server-rendered reference");
			if (!engine.referenceMarkup) {
				throw new Error("No server markup was rendered");
			}
			return engine.referenceMarkup;
		},
	};
}
