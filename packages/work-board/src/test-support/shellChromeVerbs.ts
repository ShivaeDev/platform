import type { ScreenEngine } from "./screenEngine.ts";
import { accessibleOf, pressKey, shellActs, shellElement } from "./shellScreenAct.ts";

const SETTINGS = '[role="dialog"][aria-label="Settings"]';

function settingsChoice(name: string) {
	const choice = [...document.querySelectorAll<HTMLElement>(`${SETTINGS} [role="group"] button`)].find((button) => button.textContent === name);
	if (!choice) {
		throw new Error(`Settings offers no ${name}`);
	}
	return choice;
}

export function shellChromeVerbs(engine: ScreenEngine, tell: (line: string) => void) {
	const { acting, reading } = shellActs(engine, tell);
	return {
		appearanceChoices: () =>
			reading("the reader reads which theme and density Settings shows pressed", () =>
				[...document.querySelectorAll(`${SETTINGS} [role="group"] [aria-pressed="true"]`)].map((button) => button.textContent),
			),
		browserPath: () => reading("the reader reads the browser's address", () => window.location.pathname),
		chooseAppearance: (name: string) => acting(`the reader chooses ${name} in Settings`, () => settingsChoice(name).click()),
		currentPage: () => reading("the reader reads the page the Board shows", () => engine.router?.state.location.href),
		focusedField: () =>
			reading("the reader checks the text field that has keyboard focus", () => {
				const field = document.activeElement;
				if (!(field instanceof HTMLInputElement || field instanceof HTMLTextAreaElement)) {
					return "focus is not in a text field";
				}
				return { selection: [field.selectionStart, field.selectionEnd, field.selectionDirection], value: field.value };
			}),
		focusedId: () => reading("the reader checks which element has keyboard focus", () => document.activeElement?.id),
		focusSearchButton: () =>
			acting("the reader moves focus to the header's Search button", () => shellElement("#search-open", "Search button").focus()),
		keyboardFocus: () =>
			reading("the reader checks which control has keyboard focus", () => {
				const { name, role } = accessibleOf(document.activeElement ?? document.body);
				return { name, role };
			}),
		keyboardHint: () => reading("the reader looks for a keyboard hint", () => document.querySelector("kbd")?.textContent),
		openSettings: () => acting("the reader opens Settings", () => shellElement("#settings-open", "Settings button").click()),
		pageAppearance: () =>
			reading("the reader checks the page's colour scheme and density", () => ({
				density: document.documentElement.dataset.density,
				scheme: document.documentElement.classList.contains("dark") ? "dark" : "light",
			})),
		pressKeyboard: (key: string) =>
			acting(`the reader presses ${key}`, () => {
				pressKey(document.activeElement ?? document.body, key);
			}),
		settingsPanel: () => reading("the reader checks whether Settings is open", () => (document.querySelector(SETTINGS) ? "open" : "closed")),
		shellPreferences: () =>
			reading("the reader checks the page's theme, density and sidebar", () => {
				const { density, sidebar, theme } = document.documentElement.dataset;
				return { density, sidebar, theme };
			}),
		sidebarButton: () =>
			reading("the reader reads the header's Sidebar button", () => {
				const button = shellElement("#sidebar-toggle", "Sidebar button");
				return { expanded: button.getAttribute("aria-expanded"), name: accessibleOf(button).name, visibleText: button.textContent };
			}),
		todayLink: () =>
			reading("the reader reads the header's Today link and its badge", () => {
				const link = shellElement("#inbox-topbar", "Today link");
				const badge = shellElement("#inbox-topbar-count", "Today badge");
				return {
					badge: badge.getAttribute("aria-label"),
					count: badge.querySelector("svg.animate-spin") ? "spinner" : badge.textContent,
					name: link.getAttribute("aria-label"),
				};
			}),
		todayLinkShown: () =>
			reading("the reader checks whether the header shows its Today link", () =>
				shellElement("#inbox-topbar", "Today link").hidden ? "hidden" : "shown",
			),
		toggleSidebar: () =>
			acting("the reader clicks the Sidebar button", () => {
				const button = shellElement("#sidebar-toggle", "Sidebar button");
				button.focus();
				button.click();
			}),
		toggleUpdates: () => acting("the reader clicks the updates toggle in Settings", () => shellElement("#updates-toggle", "updates toggle").click()),
		updatesToggle: () =>
			reading("the reader reads the updates toggle and whether live updates are paused", () => {
				const toggle = shellElement("#updates-toggle", "updates toggle");
				if (!(engine.view && engine.updatesPaused)) {
					throw new Error("No updates control is open");
				}
				return { label: toggle.textContent, paused: engine.view.registry.get(engine.updatesPaused), pressed: toggle.getAttribute("aria-pressed") };
			}),
	};
}
