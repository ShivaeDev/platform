import { Effect } from "effect";
import { act } from "react";
import { vi } from "vitest";
import { screenDriver } from "@shivaedev/test-story/server/screenDriver.ts";
import type { ScreenEngine } from "./screenEngine.ts";
import { screenSettles } from "./screenSettle.ts";
import { setNativeValue } from "./setNativeValue.ts";

function all(selector: string, within: ParentNode = document) {
	return [...within.querySelectorAll<HTMLElement>(selector)];
}

function routeOf(href: string | null | undefined) {
	return Object.fromEntries(new URL(href ?? "", "http://board").searchParams);
}

export function workTableVerbs(engine: ScreenEngine, tell: (line: string) => void) {
	const { accessible } = screenDriver({ root: () => document.body, tell: () => undefined });
	function named(selector: string, name: string, within: ParentNode = document) {
		const element = all(selector, within).find((candidate) => accessible(candidate).name === name);
		if (!element) {
			throw new Error(`The page has no ${selector} named ${name}`);
		}
		return element;
	}
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
		allWorkGroups: () =>
			reads("the reader reads each All work group with its badge and cards", () =>
				all(".work-column").map((column) => ({
					badge: column.querySelector("h2 .work-count")?.textContent ?? "none",
					cards: all("[data-item]", column).map((card) => card.dataset.item),
					group: column.getAttribute("aria-label"),
				})),
			),
		chooseLaneTab: (name: string) => acts(`the reader chooses the ${name} lane tab`, () => named("[role='tab']", name).click()),
		chooseSavedView: (name: string) =>
			acts(`the reader chooses ${name} in the saved views menu`, async () => {
				const trigger = document.querySelector<HTMLElement>("#saved-view");
				if (!trigger) {
					throw new Error("The page has no saved views menu");
				}
				trigger.click();
				await Promise.resolve();
				named('[role="option"]', name).click();
			}),
		chooseWorkLayout: (name: string) =>
			acts(`the reader chooses the ${name} work layout`, () =>
				named("a", name, document.querySelector('nav[aria-label="Work layout"]') ?? document).click(),
			),
		findWork: (text: string) =>
			acts(`the reader finds work matching ${JSON.stringify(text)}`, () => {
				const field = named("input", "Find work");
				if (!(field instanceof HTMLInputElement)) {
					throw new Error("Find work is not a text field");
				}
				setNativeValue(field, text);
				field.dispatchEvent(new Event("input", { bubbles: true }));
				named("button", "Apply").click();
			}),
		removeChosenView: () => acts("the reader removes the chosen saved view", () => named("button", "Remove").click()),
		resetWorkFilters: () => acts("the reader resets the work filters", () => named("#work-filters a", "Reset").click()),
		savedViews: () =>
			reads("the reader reads the saved views control and the link it offers", () => {
				const open = document.querySelector<HTMLAnchorElement>("#open-saved-view");
				return {
					chosen: document.querySelector("#saved-view [data-slot='select-value']")?.textContent,
					opens: !open || open.hidden ? "nothing" : routeOf(open.getAttribute("href")),
				};
			}),
		saveTableView: (name: string) =>
			acts(`the reader saves the current work as the view ${name}`, () => {
				const field = named("input", "View name");
				if (!(field instanceof HTMLInputElement)) {
					throw new Error("View name is not a text field");
				}
				setNativeValue(field, name);
				field.dispatchEvent(new Event("input", { bubbles: true }));
				named("button", "Save view").click();
			}),
		scrollWorkList: (pixels: number) =>
			acts(`the reader scrolls ${pixels.toLocaleString("en")} pixels into the work list`, () => {
				const list = document.querySelector("[data-slot=table-container]")?.parentElement ?? document.querySelector<HTMLElement>(".work-card-list");
				if (!list) {
					throw new Error("The page shows no work list");
				}
				list.scrollTop = pixels;
				list.dispatchEvent(new Event("scroll", { bubbles: true }));
				vi.spyOn(list, "getBoundingClientRect").mockReturnValue(new DOMRect(0, -pixels, list.clientWidth, list.clientHeight));
				window.dispatchEvent(new Event("scroll"));
			}),
		sortTableBy: (column: string) => acts(`the reader clicks the ${column} column header`, () => named("#work-results thead a", column).click()),
		tableSelection: () =>
			reads("the reader reads which Table row is selected and which title link is current", () => ({
				current: all("#work-results tbody a[aria-current='true']").map((link) => link.textContent),
				selected: all("#work-results tr[data-state='selected']").map((row) => row.dataset.item),
			})),
		tableTitles: () =>
			reads("the reader reads the Table's titles in order", () => all("#work-results tbody th[scope='row'] a").map((link) => link.textContent)),
		workFilterReset: () =>
			reads("the reader looks for Reset among the work filters", () => (document.querySelector("#work-filters a") ? "offered" : "not offered")),
	};
}
