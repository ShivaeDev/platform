import { screenDriver } from "@shivaedev/test-story/screenDriver.ts";
import type { ScreenEngine } from "./screenEngine.ts";

export function screenObservations(engine: ScreenEngine, tell: (line: string) => void) {
	function root() {
		return engine.container ?? engine.view?.container ?? document;
	}
	const { accessible } = screenDriver({ pending: () => false, root: () => document.body, tell });
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
		count: (selector: string, within?: ParentNode | null) => elements(selector, within).length,
		findByRole: (role: string, name: string | RegExp, within: ParentNode | null = root()) => {
			tell(`the reader finds the ${role} named ${name}`);
			return (
				[...(within?.querySelectorAll<HTMLElement>("*") ?? [])].find((candidate) => {
					const found = accessible(candidate);
					return found.role === role && (typeof name === "string" ? found.name === name : name.test(found.name));
				}) ?? null
			);
		},
		findElement: element,
		findElements: elements,
		location: () => {
			tell("the reader reads the current route");
			return engine.router?.state.location;
		},
		readAttribute: (selector: string, name: string, within?: ParentNode | null) => element(selector, within)?.getAttribute(name),
		readDefaultText: (selector: string) => {
			tell(`the reader reads the visible ${selector} content`);
			const copy = element(selector)?.cloneNode(true);
			if (!(copy instanceof HTMLElement)) {
				throw new Error(`Missing ${selector}`);
			}
			for (const detail of copy.querySelectorAll("details:not([open])")) {
				detail.remove();
			}
			return copy.textContent;
		},
		readDisabled: (control: Element) => {
			tell("the reader checks whether the control is disabled");
			// happy-dom leaves a control in a disabled fieldset enabled, which browsers do not.
			return control.matches(":disabled") || control.closest("fieldset")?.disabled === true;
		},
		readFocus: () => {
			tell("the reader checks keyboard focus");
			return document.activeElement;
		},
		readPaused: () => {
			tell("the reader checks whether live updates are paused");
			if (!(engine.view && engine.updatesPaused)) {
				throw new Error("No updates control is open");
			}
			return engine.view.registry.get(engine.updatesPaused);
		},
		readRootAttribute: (name: string) => {
			tell(`the reader checks browser ${name}`);
			return document.documentElement.getAttribute(name);
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
