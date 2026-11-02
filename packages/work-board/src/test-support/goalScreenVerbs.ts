import { Effect } from "effect";
import { act } from "react";
import type { ScreenEngine } from "./screenEngine.ts";
import { screenSettles } from "./screenSettle.ts";

const PROGRESS = '[data-goal-section="progress"]';

function one(selector: string, within: ParentNode = document) {
	return within.querySelector<HTMLElement>(selector);
}

function all(selector: string, within: ParentNode = document) {
	return [...within.querySelectorAll<HTMLElement>(selector)];
}

function present(element: HTMLElement | null, missing: string) {
	if (!element) {
		throw new Error(missing);
	}
	return element;
}

function progressBar(place: HTMLElement | null) {
	const bar = place?.querySelector<HTMLElement>('[data-goal-progress][role="progressbar"]');
	if (!bar) {
		return "no progress bar";
	}
	return {
		label: bar.getAttribute("aria-label"),
		shown: bar.querySelector('[data-slot="progress-value"]')?.textContent,
		spoken: bar.getAttribute("aria-valuetext"),
		value: `${bar.getAttribute("aria-valuenow")} of ${bar.getAttribute("aria-valuemax")}`,
		widths: Object.fromEntries(all("[data-goal-state]", bar).map((segment) => [segment.dataset.goalState, segment.style.width])),
	};
}

function goalCard(id: string) {
	return present(one(`[data-goal-id="${id}"]`), `No goal card for ${id}`);
}

function stateCounts(list: HTMLElement | null) {
	return all("li[data-status]", list ?? document.createElement("ul")).map(
		(entry) => `${entry.dataset.count} ${entry.dataset.status}${entry.querySelector("[data-quiet-count]") ? " (quiet)" : ""}`,
	);
}

function columnCell(row: HTMLElement, name: string) {
	const table = row.closest("table");
	const column = [...(table?.querySelectorAll('th[scope="col"]') ?? [])].findIndex((head) => head.textContent === name);
	if (column < 0) {
		return `no ${name} column`;
	}
	const cell = row.children[column];
	return cell?.querySelector("a")?.getAttribute("href") ?? (cell?.textContent === "" ? "empty" : cell?.textContent);
}

function goalChart() {
	const breakdown = one(`${PROGRESS} [data-goal-breakdown]`);
	if (!breakdown) {
		return { state: "absent" };
	}
	const failure = breakdown.querySelector("[data-goal-chart-error]");
	if (failure) {
		return { message: failure.textContent, state: "failed" };
	}
	const chart = breakdown.querySelector<HTMLElement>('[data-slot="chart"]');
	const placeholder = breakdown.querySelector<HTMLElement>('[data-slot="skeleton"]');
	return chart ? { height: chart.style.height, state: "chart" } : { height: placeholder?.style.height, state: placeholder ? "loading" : "empty" };
}

function focusable(element: Element) {
	return element.getAttribute("href") ?? element.tagName.toLowerCase();
}

function group(row: HTMLElement) {
	return row.closest<HTMLElement>("[data-goal-group]")?.dataset.goalGroup;
}

export function goalScreenVerbs(engine: ScreenEngine, tell: (line: string) => void) {
	function reads<T>(line: string, read: () => T) {
		return Effect.sync(() => {
			tell(line);
			return read();
		});
	}
	function clicks(line: string, target: () => HTMLElement) {
		return Effect.gen(function* () {
			tell(line);
			const element = target();
			yield* Effect.promise(() => act(async () => element.click()));
			yield* screenSettles(engine, tell);
		});
	}
	return {
		childLaneProgress: (lane: string) =>
			reads(`the reader reads the progress of child lane ${lane} on the goal page`, () =>
				progressBar(one(`${PROGRESS} section[aria-label="${lane}"]`)),
			),
		criterionCard: (id: string) =>
			reads(`the reader reads criterion ${id}`, () => {
				const card = present(one(`[data-criterion="${id}"]`), `No criterion ${id}`);
				return {
					linkedItems: card.querySelector('[data-slot="collapsible-trigger"]')?.textContent,
					progress: card.querySelector("[data-criterion-progress]")?.textContent,
					title: card.querySelector("h3")?.textContent,
					work: card.querySelector("[data-criterion-work]") ? "shown" : "folded",
				};
			}),
		criterionChartCounts: () =>
			reads("the reader reads the counts written on the goal chart's bars", () =>
				all(`${PROGRESS} .recharts-label-list text`).map((label) => label.textContent),
			),
		criterionChartLabels: () =>
			reads("the reader reads the criterion labels on the goal chart and where each leads", () =>
				all(`${PROGRESS} [data-goal-criterion-label]`).map((label) => {
					const link = label.querySelector("a")?.getAttribute("href");
					return {
						leadsTo: link ? one(`${decodeURIComponent(link)} h3`)?.textContent : "nowhere",
						link: link ?? "none",
						text: label.textContent,
					};
				}),
			),
		goalAskLinks: () =>
			reads("the reader reads the links in the open asks list", () => all("[data-goal-ask-list] a").map((link) => link.getAttribute("href"))),
		goalCardFacts: (id: string) =>
			reads(`the reader reads the card of goal ${id}`, () => {
				const card = goalCard(id);
				return {
					criteria: all("li", card).map((row) => `${row.querySelector("a")?.textContent} ${row.querySelector("span")?.textContent}`),
					nextAction: card.querySelector("h2 + p[title]")?.textContent,
					openAsks: [...card.querySelectorAll("p")].find((line) => /open asks?$/u.test(line.textContent ?? ""))?.textContent,
					progress: card.querySelector('[data-goal-progress] [data-slot="progress-value"]')?.textContent,
					title: card.querySelector("h2")?.textContent,
				};
			}),
		goalCardLinks: (id: string) =>
			reads(`the reader reads the links on the card of goal ${id}`, () => all("a", goalCard(id)).map((link) => link.getAttribute("href"))),
		goalCardProgress: (id: string) => reads(`the reader reads the progress bar on the card of goal ${id}`, () => progressBar(goalCard(id))),
		goalChart: () => reads("the reader reads the goal page's chart", goalChart),
		goalList: () =>
			reads("the reader reads which goals the Goals page lists in each section", () => {
				const sections = [...document.querySelectorAll<HTMLDetailsElement>("details")];
				function folded(summary: string) {
					return sections.find((section) => section.querySelector("summary")?.textContent === summary);
				}
				function ids(within: HTMLElement) {
					return all("[data-goal-id]", within).map((card) => card.dataset.goalId);
				}
				const active = all("[data-goal-id]").filter((card) => card.closest("details") === null);
				const deferred = folded("Deferred goals");
				const closed = folded("Closed goals");
				return {
					active: active.map((card) => card.dataset.goalId),
					closed: closed ? { ids: ids(closed), open: closed.open } : "no section",
					deferred: deferred ? { ids: ids(deferred), open: deferred.open } : "no section",
				};
			}),
		goalOpenAsks: () => reads("the reader reads the goal's open asks control", () => one("[data-goal-open-asks]")?.textContent ?? "none"),
		goalPageParts: () =>
			reads("the reader reads the goal page's introduction, progress and prose in page order", () => {
				const parts = {
					introduction: ".item-introduction",
					progress: '[data-goal-section="progress"]',
					prose: "article.doc [id^='heading-']",
				} as const;
				return Object.entries(parts)
					.flatMap(([part, selector]) => {
						const element = document.querySelector(selector);
						return element ? [{ element, part }] : [];
					})
					.sort((left, right) => (left.element.compareDocumentPosition(right.element) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1))
					.map(({ part }) => part);
			}),
		goalPageProgress: () => reads("the reader reads the goal page's progress bar", () => progressBar(one(PROGRESS))),
		goalPageStateCounts: () =>
			reads("the reader reads the goal page's linked work by state", () => stateCounts(one(`${PROGRESS} > [data-goal-counts]`))),
		goalPageTags: () =>
			reads("the reader reads the status and tags in the goal's overview", () =>
				all('.item-summary [data-status-token], .item-summary [data-slot="badge"]').map((tag) => tag.textContent),
			),
		goalProgressBar: () => reads("the reader reads the goal progress bar", () => progressBar(document.body)),
		goalProgressNotice: () =>
			reads("the reader reads what the goal page's progress section says", () => {
				const section = present(one(PROGRESS), "No goal progress section");
				const empty = section.querySelector('[data-slot="empty-title"]');
				return (empty ?? section.querySelector('[role="status"]') ?? section.querySelector(":scope > p"))?.textContent ?? "no notice";
			}),
		linkedWork: () =>
			reads("the reader reads the goal's linked work by group", () =>
				Object.fromEntries(
					all("[data-goal-group]").map((section) => [section.dataset.goalGroup, all("[data-goal-item]", section).map((row) => row.dataset.goalItem)]),
				),
			),
		linkedWorkColumns: (name: string) =>
			reads(`the reader reads the columns of the ${name} linked work group`, () =>
				all(`[data-goal-group="${name}"] th[scope="col"]`).map((head) => head.textContent),
			),
		linkedWorkFolded: () =>
			reads("the reader reads which linked work groups are folded", () =>
				all("[data-goal-group]")
					.filter((section) => section.querySelector('[data-slot="collapsible-trigger"]')?.getAttribute("aria-expanded") === "false")
					.filter((section) => section.querySelector('[data-slot="collapsible-content"]')?.getAttribute("hidden") === "until-found")
					.map((section) => section.dataset.goalGroup),
			),
		linkedWorkItems: () =>
			reads("the reader reads every item in the goal's linked work", () => all("[data-goal-item]").map((row) => row.dataset.goalItem)),
		linkedWorkRow: (id: string) =>
			reads(`the reader reads the linked work row of ${id}`, () => {
				const row = present(one(`[data-goal-item="${id}"]`), `No linked work row for ${id}`);
				const cells = [...row.querySelectorAll("td")];
				return {
					cells: cells.map((cell) => cell.textContent),
					criteria: columnCell(row, "Criteria"),
					group: group(row),
					heading: row.querySelector("th")?.textContent,
					link: row.querySelector('th[scope="row"] a')?.getAttribute("href"),
					owner: row.querySelector("[data-goal-owner]")?.textContent,
					pr: columnCell(row, "PR"),
					states: all("[data-status-token]", row).map((chip) => chip.textContent),
					tabStops: all('a[href], button, [tabindex]:not([tabindex="-1"])', row).map(focusable),
					updated: row.querySelector("[data-goal-updated] time")?.getAttribute("data-modified"),
				};
			}),
		openGoalAsks: () =>
			clicks("the reader opens the goal's open asks", () => present(one("[data-goal-open-asks]"), "The goal has no open asks control")),
	};
}
