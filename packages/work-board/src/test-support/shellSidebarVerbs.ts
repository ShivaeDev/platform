import { Effect, Order } from "effect";
import { loadQuery } from "@shivaedev/react/adapters/loadQuery.ts";
import { navigationQuery } from "#client/react/routeQuery.ts";
import type { ScreenEngine } from "./screenEngine.ts";
import { accessibleOf, pressKey, shellActs, shellElement } from "./shellScreenAct.ts";

const PRIMARY = "#primary-navigation";

function sidebar() {
	return shellElement("#sidebar", "sidebar");
}

function destinationLink(label: string, within: string) {
	const link = [...document.querySelectorAll<HTMLAnchorElement>(`${within} a`)].find((candidate) => {
		const name = accessibleOf(candidate).name;
		return name === label || name.startsWith(`${label},`);
	});
	if (!link) {
		throw new Error(`The screen offers no ${label} link in ${within}`);
	}
	return link;
}

export function shellSidebarVerbs(engine: ScreenEngine, tell: (line: string) => void) {
	const { acting, reading } = shellActs(engine, tell);
	return {
		activeGoals: () =>
			reading("the reader reads the sidebar's Active goals", () => {
				const section = document.querySelector('section[aria-label="Active goals"]');
				if (!section) {
					return "not shown";
				}
				return [...section.querySelectorAll('[role="progressbar"]')].map((bar) => ({
					progress: bar.getAttribute("aria-label"),
					shown: bar.querySelector('[data-slot="progress-value"]')?.textContent,
					statusTokens: section.querySelectorAll("[data-status-token]").length,
				}));
			}),
		currentDestination: () =>
			reading("the reader reads which destination the sidebar marks current", () =>
				document.querySelector(`${PRIMARY} [aria-current="page"]`)?.getAttribute("aria-label"),
			),
		destinationLinks: () =>
			reading("the reader reads where each sidebar destination links", () =>
				[...document.querySelectorAll(`${PRIMARY} a`)].map((link) => ({
					href: link.getAttribute("href"),
					label: link.querySelector("span")?.textContent,
				})),
			),
		dismissSidebar: (how: "Escape" | "the backdrop") =>
			acting(`the reader dismisses the sidebar with ${how}`, () => {
				if (how === "Escape") {
					pressKey(document.activeElement ?? document.body, "Escape");
				} else {
					shellElement("#sidebar-backdrop", "sidebar backdrop").click();
				}
			}),
		navigationSummary: () =>
			Effect.promise(() => {
				tell("the reader reads the Board's navigation projection");
				if (!(engine.api && engine.view)) {
					throw new Error("The Board screen has not opened");
				}
				return loadQuery(engine.view.registry, navigationQuery(engine.api), { abortController: new AbortController() });
			}).pipe(Effect.map((navigation) => ({ fields: Object.keys(navigation).sort(Order.String), libraryCount: navigation.counts.library }))),
		openSidebarDestination: (label: string) => acting(`the reader opens ${label} from the sidebar`, () => destinationLink(label, "#sidebar").click()),
		shellLinkCount: () => reading("the reader counts the links on the screen", () => document.querySelectorAll("a").length),
		sidebarDestinations: () =>
			reading("the reader reads the sidebar's destinations", () =>
				[...document.querySelectorAll(`${PRIMARY} a`)].map((link) => {
					const label = link.querySelector("span")?.textContent ?? "";
					return { count: link.textContent?.slice(label.length) || "none", label };
				}),
			),
		sidebarPanel: () =>
			reading("the reader reads whether the sidebar covers the page", () => {
				const panel = sidebar();
				return {
					focusInside: panel.contains(document.activeElement),
					modal: panel.getAttribute("aria-modal") === "true",
					pageInert: document.querySelector("[data-board-page]")?.hasAttribute("inert") ?? false,
					shown: !panel.hidden,
				};
			}),
	};
}
