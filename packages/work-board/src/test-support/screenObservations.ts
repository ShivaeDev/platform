import type { ScreenEngine } from "./screenEngine.ts";

const implicitRoles: Readonly<Record<string, string>> = {
	article: "article",
	button: "button",
	heading: "h1, h2, h3, h4, h5, h6",
	link: "a[href]",
};

function accessibleName(element: Element) {
	const labelledBy = element.getAttribute("aria-labelledby");
	if (labelledBy) {
		return labelledBy
			.split(/\s+/u)
			.map((id) => document.getElementById(id)?.textContent ?? "")
			.join(" ")
			.trim();
	}
	return (element.getAttribute("aria-label") ?? element.textContent ?? "").trim();
}

export function screenObservations(engine: ScreenEngine, tell: (line: string) => void) {
	function root() {
		return engine.container ?? engine.view?.container ?? document;
	}
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
	function byRole(role: string, name?: string, within: ParentNode = document) {
		tell(`the reader finds the ${role}${name === undefined ? "" : ` named ${JSON.stringify(name)}`}`);
		const selector = [`[role="${role}"]`, implicitRoles[role]].filter(Boolean).join(", ");
		return [...within.querySelectorAll<HTMLElement>(selector)].filter((found) => name === undefined || accessibleName(found) === name);
	}
	return {
		count: (selector: string, within?: ParentNode | null) => elements(selector, within).length,
		findAllByRole: byRole,
		findByRole: (role: string, name?: string, within?: ParentNode) => byRole(role, name, within).at(0) ?? null,
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
