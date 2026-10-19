import { fleetWorkspace } from "./fleetWorkspaceFixture.ts";
import { routedScreen } from "./screenTraits.ts";

export function workTableScreen(route: string) {
	return routedScreen(fleetWorkspace, route, { home: "home.md" });
}

export function workRouteParams() {
	return new URL(document.querySelector<HTMLElement>("#doc")?.dataset.route ?? "", "http://board").searchParams;
}

export function workTableTitles() {
	return [...document.querySelectorAll("#work-results tbody th[scope='row'] a")].map((link) => link.textContent);
}

export function labelledCombobox(triggers: readonly Element[], label: string) {
	return triggers.find((trigger) => document.querySelector(`label[for="${CSS.escape(trigger.id)}"]`)?.textContent === label);
}

export function menuOptions(trigger: Element | undefined) {
	return [...document.querySelectorAll<HTMLElement>(`#${CSS.escape(trigger?.getAttribute("aria-controls") ?? "")} [role="option"]`)];
}
