import { Effect } from "effect";
import { act } from "react";
import { screenDriver } from "@shivaedev/test-story/server/screenDriver.ts";
import type { ScreenEngine } from "./screenEngine.ts";
import { screenSettles } from "./screenSettle.ts";

const TABBABLE = 'a[href], button:not([disabled]), input, select, textarea, [tabindex]:not([tabindex="-1"])';

function all(selector: string, within: ParentNode = document) {
	return [...within.querySelectorAll<HTMLElement>(selector)];
}

function text(element: Element | null | undefined) {
	return element?.textContent ?? undefined;
}

function lane(label: string) {
	const section = document.querySelector<HTMLElement>(`section.work-column[aria-label="${label}"]`);
	if (!section) {
		throw new Error(
			`Now shows no ${label} lane; it shows ${JSON.stringify(all("section.work-column").map((column) => column.getAttribute("aria-label")))}`,
		);
	}
	return section;
}

function cardLane(card: HTMLElement) {
	return card.closest("section.work-column")?.getAttribute("aria-label") ?? "no lane";
}

function workRoute() {
	return new URL(document.querySelector<HTMLElement>("#doc")?.dataset.route ?? "", "http://board").searchParams;
}

function toolbarMenu(label: string) {
	const trigger = all("main [role='combobox']").find(
		(candidate) => document.querySelector(`label[for="${CSS.escape(candidate.id)}"]`)?.textContent === label,
	);
	if (!trigger) {
		throw new Error(`The work toolbar has no ${label} menu`);
	}
	return trigger;
}

export function nowScreenVerbs(engine: ScreenEngine, tell: (line: string) => void) {
	const { accessible } = screenDriver({ root: () => document.body, tell: () => undefined });
	function reads<T>(line: string, read: () => T) {
		return Effect.sync(() => {
			tell(line);
			return read();
		});
	}
	function acts(line: string, action: () => void | Promise<void>) {
		return Effect.gen(function* () {
			tell(line);
			yield* Effect.promise(() => act(async () => action()));
			yield* screenSettles(engine, tell);
		});
	}
	return {
		boardDocument: () =>
			reads("the reader reads the board document", () => ({
				counts: text(document.querySelector(".counts")),
				footer: text(document.querySelector("footer")),
				items: all(".board .item").map((item) => ({
					link: item.querySelector('a:not([href^="#"])')?.getAttribute("href") ?? "none",
					text: item.textContent,
				})),
				notes: all(".board .notes").map((note) => note.textContent),
				title: text(document.querySelector(".item-introduction h1")),
			})),
		chooseInToolbar: (menu: string, option: string) =>
			acts(`the reader chooses ${option} in the work toolbar's ${menu} menu`, async () => {
				toolbarMenu(menu).click();
				await Promise.resolve();
				const choice = all('[role="option"]').find((candidate) => accessible(candidate).name === option);
				if (!choice) {
					throw new Error(`The ${menu} menu offers no ${option}`);
				}
				choice.click();
			}),
		fleetAlert: () =>
			reads("the reader reads the alert above the Now lanes", () => all('[role="status"][data-slot="alert"]').map((alert) => alert.textContent)),
		laneCards: (label: string) =>
			reads(`the reader reads each card in the ${label} lane`, () =>
				all("[data-item]", lane(label)).map((card) => ({
					id: card.dataset.item,
					states: all("[data-status-token]", card).map((chip) => chip.textContent),
					title: text(card.querySelector("h3")),
				})),
			),
		mainText: () => reads("the reader reads the page", () => document.querySelector("main")?.textContent ?? ""),
		navigationLabels: () =>
			reads("the reader reads how the primary navigation names each destination", () =>
				all("#primary-navigation a").map((link) => link.getAttribute("aria-label")),
			),
		needsYouBadges: () =>
			reads("the reader reads the needs-you badges in the sidebar, header and phone tab bar", () => {
				const phone = document.querySelector<HTMLElement>('nav[aria-label="Phone navigation"] a[href="/"]');
				function badge(element: HTMLElement | null) {
					if (!element) {
						return "none";
					}
					return {
						label: element.getAttribute("aria-label"),
						shown: element.classList.contains("sr-only") ? "screen readers only" : element.textContent,
					};
				}
				return {
					header: {
						badge: badge(document.querySelector("#inbox-topbar-count")),
						label: document.querySelector("#inbox-topbar")?.getAttribute("aria-label"),
					},
					phone: phone ? { badge: text(phone.querySelector('[data-slot="badge"]')) ?? "none", label: accessible(phone).name } : "none",
					sidebar: badge(document.querySelector("#inbox-count")),
				};
			}),
		nowCard: (id: string) =>
			reads(`the reader reads the work card ${id}`, () => {
				const card = document.querySelector<HTMLElement>(`[data-item="${id}"]`);
				if (!card) {
					return "no card";
				}
				return {
					kind: text(card.querySelector(".work-kind")) ?? "none",
					lane: cardLane(card),
					owner: text(card.querySelector(".work-owner")) ?? "none",
					reason: text(card.querySelector(":scope > p:not([class*='work-'])")) ?? "none",
					stage: text(card.querySelector(".work-stage")) ?? "none",
					states: all("[data-status-token]", card).map((chip) => chip.textContent),
					tabStops: all(TABBABLE, card).map((element) => element.getAttribute("href") ?? element.tagName.toLowerCase()),
					text: card.textContent,
					title: text(card.querySelector("h3")),
				};
			}),
		nowLane: (label: string) =>
			reads(`the reader reads the ${label} lane`, () => {
				const section = lane(label);
				const trigger = section.querySelector("[aria-expanded]");
				const empty = {
					description: text(section.querySelector('[data-slot="empty-description"]')),
					title: text(section.querySelector('[data-slot="empty-title"]')),
				};
				const unfolded = trigger?.getAttribute("aria-expanded") === "true" ? "open" : "folded";
				return {
					cards: all("[data-item]", section).map((card) => card.dataset.item),
					count: text(section.querySelector(".work-count")) ?? "none",
					empty: section.querySelector('[data-slot="empty"]') ? empty : "none",
					fold: trigger ? unfolded : "never folds",
					note: text(section.querySelector(":scope > p")) ?? "none",
				};
			}),
		nowLanes: () =>
			reads("the reader reads the Now lanes and their counts", () =>
				all("section.work-column").map(
					(column) => `${column.getAttribute("aria-label")}: ${text(column.querySelector(".work-count")) ?? "no count"}`,
				),
			),
		openPullRequests: () =>
			acts("the reader opens Pull requests from the sidebar", () => {
				const link = document.querySelector<HTMLElement>("#pull-requests-open");
				if (!link) {
					throw new Error("The sidebar has no Pull requests link");
				}
				link.click();
			}),
		pageProjection: () =>
			reads("the reader reads which projection the page renders", () => document.querySelector<HTMLElement>("main")?.dataset.projection ?? "none"),
		phoneLane: () =>
			reads("the reader reads the lane the phone shows", () => ({
				cards: all("[role='tabpanel'] [data-item]").map((card) => card.dataset.item),
				lanes: all("[role='tabpanel'] section.work-column").map((column) => column.getAttribute("aria-label")),
				tabs: accessible(document.querySelector<HTMLElement>("[role='tablist']") ?? document.body).name,
			})),
		pullRequestGroups: () =>
			reads("the reader reads the pull request groups in order", () =>
				all("#doc section").map(
					(section) =>
						`${section.getAttribute("aria-label")}: ${all("[data-pr-work]", section)
							.map((row) => row.dataset.prWork)
							.join(", ")}`,
				),
			),
		pullRequestRow: (id: string) =>
			reads(`the reader reads the pull request row of ${id}`, () => {
				const row = document.querySelector<HTMLElement>(`[data-pr-work="${id}"]`);
				if (!row) {
					return "no row";
				}
				return {
					links: all("a", row).map((link) => `${link.textContent} → ${link.getAttribute("href")}`),
					text: row.textContent,
					time: text(row.querySelector("time")),
				};
			}),
		pullRequestsLink: () =>
			reads("the reader reads the sidebar's Pull requests link", () => {
				const link = document.querySelector("#pull-requests-open");
				const badge = link?.querySelector("[role='status']");
				return link
					? { badge: badge ? { label: badge.getAttribute("aria-label"), shown: badge.textContent } : "none", href: link.getAttribute("href") }
					: "none";
			}),
		tableRows: () =>
			reads("the reader reads the Table's rows", () =>
				all("#work-results tbody tr[data-item]").map((row) => {
					const header = row.querySelector("th[scope='row']");
					const link = header?.querySelector("a");
					return {
						current: link?.getAttribute("aria-current") === "true",
						id: row.dataset.item,
						idShown: text(header?.querySelector(".font-mono")),
						link: link ? { name: accessible(link).name, opens: new URL(link.href, "http://board").searchParams.get("item") } : "none",
						selected: row.dataset.state === "selected",
						title: link?.textContent,
					};
				}),
			),
		tableSort: () =>
			reads("the reader reads which Table column sorts the rows and in which order", () => {
				const head = document.querySelector<HTMLElement>("#work-results th[aria-sort]");
				return head ? { column: accessible(head).name, order: head.getAttribute("aria-sort") } : "unsorted";
			}),
		toolbarChoice: (menu: string) =>
			reads(`the reader reads the work toolbar's ${menu} menu`, () => text(toolbarMenu(menu).querySelector("[data-slot='select-value']"))),
		unfoldLane: (label: string) =>
			acts(`the reader unfolds the ${label} lane`, () => {
				const trigger = lane(label).querySelector<HTMLElement>('[aria-expanded="false"]');
				if (!trigger) {
					throw new Error(`The ${label} lane is not folded`);
				}
				trigger.click();
			}),
		workAddress: () => reads("the reader reads the work page's address", () => Object.fromEntries(workRoute())),
		workDetail: () =>
			reads("the reader reads the selected work beside the list", () => {
				const detail = document.querySelector("#work-detail");
				if (!detail) {
					return "closed";
				}
				return {
					document: text(detail.querySelector("article.doc")),
					notice: text(detail.querySelector('[role="status"].detail-notice')) ?? "none",
					summary: text(detail.querySelector(".item-summary")),
				};
			}),
		workDetailAnswer: () =>
			reads("the reader reads the answer field in the selected work", () => {
				const field = document.querySelector<HTMLTextAreaElement>("#work-detail #response-form textarea");
				return field ? { selection: [field.selectionStart, field.selectionEnd], value: field.value } : "no answer field";
			}),
		workItems: () => reads("the reader reads every work item the page shows", () => all("[data-item]").map((item) => item.dataset.item)),
		workLayout: () =>
			reads("the reader reads the work page's heading and chosen layout", () => ({
				chosen: text(document.querySelector('nav[aria-label="Work layout"] [aria-current="page"]')),
				heading: text(document.querySelector("main h1")),
			})),
		workListWindow: (rows: number) =>
			reads(`the reader reads which of the ${rows.toLocaleString("en")} work rows the list renders`, () => {
				const rendered = all("[data-item]");
				return { first: rendered[0]?.dataset.item, renders: rendered.length < rows ? "a window" : "every row" };
			}),
		workOptions: () =>
			reads("the reader reads the work page's Filter disclosure", () => {
				const options = document.querySelector<HTMLDetailsElement>(".work-options");
				if (!options) {
					return "none";
				}
				return {
					holds: [...options.querySelectorAll("[id]")].map((part) => part.id).filter((id) => ["saved-work-views", "work-filters"].includes(id)),
					open: options.open,
					summary: text(options.querySelector("summary")),
				};
			}),
		workTotal: () => reads("the reader reads the work total", () => text(document.querySelector(".work-total")) ?? "none"),
	};
}
