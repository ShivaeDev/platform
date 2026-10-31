import { Effect } from "effect";
import { act } from "react";
import { screenDriver } from "@shivaedev/test-story/server/screenDriver.ts";
import { screenData } from "./screenData.ts";
import type { ScreenEngine } from "./screenEngine.ts";
import { screenSettles } from "./screenSettle.ts";

const TABBABLE = 'a[href], button:not([disabled]), input, select, textarea, summary, [tabindex]:not([tabindex="-1"])';

function all(selector: string, within: ParentNode = document) {
	return [...within.querySelectorAll<HTMLElement>(selector)];
}

function inProgressRegion() {
	return document.querySelector<HTMLElement>("#in-progress") ?? document.body;
}

export function todayScreenVerbs(engine: ScreenEngine, tell: (line: string) => void) {
	const { accessible } = screenDriver({ root: () => document.body, tell: () => undefined });
	function reads<T>(line: string, read: () => T) {
		return Effect.sync(() => {
			tell(line);
			return read();
		});
	}
	function named(element: Element) {
		return accessible(element);
	}
	return {
		inProgressList: () =>
			reads("the reader reads the work in progress", () => {
				const region = inProgressRegion();
				const busy = region.querySelector('[role="status"][aria-busy="true"]');
				return {
					empty: region.querySelector('[data-slot="empty-title"]')?.textContent ?? "none",
					loading: busy ? `${busy.textContent}${region.querySelector('[data-loading] [data-slot="skeleton"]') ? " with skeleton rows" : ""}` : "none",
					now: region.querySelector('a[href="/_board/work"]')?.textContent ?? "none",
					rows: all("[data-progress-id]", region).map((row) => ({
						badge: row.querySelector('[data-slot="badge"]')?.textContent,
						id: row.dataset.progressId,
						pr: row.querySelector('a[aria-label^="Pull request"]')?.getAttribute("href") ?? "none",
						title: row.querySelector("a")?.textContent,
					})),
					status: all('[role="status"]:not([aria-busy="true"])', region).map((status) => status.textContent),
				};
			}),
		needsYouRows: () =>
			reads("the reader reads each row under Needs you", () =>
				all("ul[aria-label='Needs you'] > li").map((row) => {
					const [heading, ...actions] = all("a, button", row);
					return {
						actions: actions.map(named),
						age: row.querySelector("time")?.textContent ?? row.querySelector(".today-row > span")?.textContent,
						detail: row.querySelector(".today-row > p")?.textContent,
						tabStops: all(TABBABLE, row).map((element) => named(element).name),
						title: heading ? named(heading).name : "none",
					};
				}),
			),
		openTodayFromNavigation: () =>
			Effect.gen(function* () {
				tell("the reader opens Today from the primary navigation");
				const link = document.querySelector<HTMLElement>("#home-open");
				if (!link) {
					throw new Error("The primary navigation has no Today link");
				}
				yield* Effect.promise(() => act(async () => link.click()));
				yield* screenSettles(engine, tell);
			}),
		pageHealth: () =>
			reads("the reader reads whether Today's read is pending, settled or failed, and the page's status code", () => ({
				health: document.querySelector('[aria-label="Page health"]')?.textContent,
				status: document.querySelector("#doc")?.getAttribute("data-status"),
			})),
		recordedAnswerTexts: (item: string, request: string) =>
			Effect.promise(async () => {
				const saved = await screenData(engine, tell).readResponses(item, request);
				return saved.responses.map((entry) => entry.body);
			}),
		todayAnswerContent: () =>
			reads("the reader reads the open Today answer", () => document.querySelector("[role='dialog']")?.textContent ?? "closed"),
		todayAnswerControls: () =>
			reads("the reader reads the controls in the open Today answer", () =>
				all(":is(a, button, input, textarea, select, summary)", document.querySelector("[role='dialog']") ?? document.createElement("div")).map(
					named,
				),
			),
		todayAnswerRecordable: () =>
			reads("the reader reads whether the Today answer can be recorded", () => {
				const button = document.querySelector("[role='dialog'] button[type='submit']");
				if (!button) {
					return "no record button";
				}
				return button.hasAttribute("disabled") ? "disabled" : "enabled";
			}),
		todayColumns: () =>
			reads("the reader reads Today's sections column by column", () =>
				all(".today-grid > *").map((column) => all("h2", column).map((heading) => heading.textContent)),
			),
		todayGoalCard: (id: string) =>
			reads(`the reader reads the Today card of goal ${id}`, () => {
				const card = document.querySelector<HTMLElement>(`#today-goals [data-goal-id="${id}"]`);
				if (!card) {
					return "no card";
				}
				const next = card.querySelector("[data-goal-next-action]");
				return {
					criteria: all("details li", card).map((row) => `${row.querySelector("a")?.textContent}: ${row.querySelector("p")?.textContent}`),
					criteriaOpen: card.querySelector("details")?.open ?? false,
					nextAction: next ? { text: next.textContent, title: next.getAttribute("title") } : "none",
					title: card.querySelector("h3")?.textContent,
				};
			}),
		todayHomeLink: () =>
			reads("the reader reads the link to the workspace home in Today's header", () => {
				const link = document.querySelector("[data-page-actions] a");
				return link ? { href: link.getAttribute("href"), text: link.textContent } : "none";
			}),
		todaySummaryParts: () =>
			reads("the reader reads each part of the Today summary and where it leads", () =>
				all(".today-strip > a, .today-strip > [role='status']").map((part) => {
					if (part.tagName === "A") {
						return `${part.textContent} → ${part.getAttribute("href")}`;
					}
					return `${part.textContent} (loading${part.querySelector('[data-slot="skeleton"]') ? "" : ", no skeleton"})`;
				}),
			),
	};
}
