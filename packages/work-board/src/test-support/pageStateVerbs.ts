import { Effect } from "effect";
import { act } from "react";
import type { ScreenEngine } from "./screenEngine.ts";
import { screenSettles } from "./screenSettle.ts";

const REGIONS = {
	criteria: '[data-goal-section="criteria"]',
	"handoff history": "#handoff-history",
	"in progress": "#in-progress",
	"linked work": '[data-goal-section="progress"]',
	"Needs you": "#needs-you",
	page: "#doc",
	"reading history": "#library-dialog",
	search: "#search-dialog",
	"sidebar Active goals": '#sidebar [aria-label="Active goals"]',
	"sidebar Pinned": '#sidebar [aria-label="Pinned"]',
	"source problems": "#source-problems",
	"Today goals": "#today-goals",
	"work results": "#work-results",
} as const;

export type PageRegion = keyof typeof REGIONS;

function region(name: PageRegion) {
	const element = document.querySelector<HTMLElement>(REGIONS[name]) ?? (name === "page" ? document.body : null);
	if (!element) {
		throw new Error(`The screen has no ${name} region`);
	}
	return element;
}

export function pageStateVerbs(engine: ScreenEngine, tell: (line: string) => void) {
	return {
		emptyState: (name: PageRegion = "page") =>
			Effect.sync(() => {
				tell(`the reader reads the empty state in ${name}`);
				const empty = region(name).querySelector<HTMLElement>('[data-slot="empty"]');
				if (!empty) {
					return "no empty state";
				}
				const action = empty.querySelector("a, button");
				return {
					action: action ? { label: action.textContent, ...(action.getAttribute("href") ? { href: action.getAttribute("href") } : {}) } : "none",
					description: empty.querySelector('[data-slot="empty-description"]')?.textContent,
					title: empty.querySelector('[data-slot="empty-title"]')?.textContent,
				};
			}),
		followEmptyState: (name: PageRegion = "page") =>
			Effect.gen(function* () {
				const action = region(name).querySelector<HTMLElement>('[data-slot="empty"] a, [data-slot="empty"] button');
				if (!action) {
					throw new Error(`The empty state in ${name} offers nothing to follow`);
				}
				tell(`the reader follows ${action.textContent} in the empty state in ${name}`);
				yield* Effect.promise(() => act(async () => action.click()));
				yield* screenSettles(engine, tell);
			}),
		loadingState: (name: PageRegion = "page") =>
			Effect.sync(() => {
				tell(`the reader reads what ${name} says while it loads`);
				const status = region(name).querySelector<HTMLElement>('[role="status"][aria-busy="true"]');
				if (!status) {
					return "not loading";
				}
				return {
					shape: region(name).querySelector<HTMLElement>("[data-loading-shape]")?.dataset.loadingShape,
					skeletons: region(name).querySelector('[data-slot="skeleton"]') ? "shown" : "none",
					status: status.textContent,
				};
			}),
		pageRulings: () =>
			Effect.sync(() => {
				tell("the reader reads the rulings the page shows on this work");
				return [...document.querySelectorAll('[aria-label="Ruling"]')].map((ruling) => ruling.textContent);
			}),
		pageSummary: () =>
			Effect.sync(() => {
				tell("the reader reads the page header's summary");
				return document.querySelector("[data-page-summary]")?.textContent ?? "no summary";
			}),
		resultReviewNote: () =>
			Effect.sync(() => {
				tell("the reader reads what the result says about review and feedback");
				return document.querySelector("[data-result-empty]")?.textContent ?? "no note";
			}),
		searchIncludesFleetFiles: () =>
			Effect.sync(() => {
				tell("the reader reads whether Search includes files Fleet writes");
				return document.querySelector('#search-dialog [role="checkbox"]')?.getAttribute("aria-checked") === "true";
			}),
	};
}
