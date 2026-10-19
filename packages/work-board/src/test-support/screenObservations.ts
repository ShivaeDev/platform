import { screenDriver } from "@shivaedev/test-story/server/screenDriver.ts";
import type { ScreenEngine } from "./screenEngine.ts";

function columnLayout(cells: readonly HTMLTableCellElement[]) {
	if (cells.every((cell) => cell.classList.contains("min-w-[20ch]") && cell.classList.contains("whitespace-normal"))) {
		return "readable width";
	}
	return cells.every((cell) => cell.classList.contains("whitespace-nowrap") && !cell.classList.contains("whitespace-normal")) ? "one line" : "mixed";
}

function tableLayout(table: HTMLTableElement) {
	const container = table.parentElement;
	const rows = [...table.rows].map((row) => [...row.cells]);
	return {
		columns: (rows[0] ?? []).map((head, index) => [head.textContent, columnLayout(rows.flatMap((row) => row[index] ?? []))] as const),
		scrolls: container?.dataset.slot === "table-container" && container.classList.contains("overflow-x-auto"),
	};
}

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
		readOrder: (...selectors: readonly string[]) => {
			tell(`the reader reads in which order ${selectors.join(", ")} appear`);
			const found = selectors.flatMap((selector) => {
				const match = element(selector);
				return match ? [{ match, selector }] : [];
			});
			found.sort((left, right) => (left.match.compareDocumentPosition(right.match) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1));
			return found.map(({ selector }) => selector);
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
		readTableLayout: (selector: string, within?: ParentNode | null) => {
			const table = element<HTMLTableElement>(selector, within);
			if (!table) {
				throw new Error(`Missing ${selector}`);
			}
			tell("the reader checks how the table columns wrap and whether the table scrolls in its own box");
			return tableLayout(table);
		},
		readTabStops: (target: string | Element | null | undefined) => {
			tell(`the reader tabs through ${typeof target === "string" ? target : target?.textContent}`);
			const within = typeof target === "string" ? element(target) : target;
			return [...(within?.querySelectorAll<HTMLElement>("*") ?? [])].filter(
				(candidate) => candidate.tabIndex >= 0 && !candidate.matches(":disabled") && candidate.closest("[inert]") === null,
			);
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
