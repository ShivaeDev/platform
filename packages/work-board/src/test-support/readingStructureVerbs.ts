import { Effect, Order } from "effect";
import { act } from "react";
import { readingSettles } from "./readingSettle.ts";
import type { ScreenEngine } from "./screenEngine.ts";
import { accessibleOf } from "./shellScreenAct.ts";

type Direction = "links-to" | "linked-from";

const LANDMARK_ROLES: ReadonlySet<string> = new Set(["complementary", "navigation", "region"]);
const ABSENT_VALUE_NOTES = ["not recorded", "These are explicit source links", "Open/closed is source state", "Acceptance is not established"];

function text(element: Element | null | undefined) {
	return element?.textContent?.trim() ?? "";
}

function page() {
	return document.getElementById("doc");
}

function landmarkName(element: Element) {
	const { name, role } = accessibleOf(element);
	return name !== "" && role !== null && LANDMARK_ROLES.has(role) ? name : undefined;
}

function landmarkOf(element: Element) {
	for (let node = element.parentElement; node && node.id !== "doc"; node = node.parentElement) {
		const name = landmarkName(node);
		if (name !== undefined) {
			return name;
		}
	}
	return element.closest("[data-page-header]") ? "the page header" : "the document text";
}

function tabStops() {
	return [...(page()?.querySelectorAll<HTMLElement>("*") ?? [])].filter(
		(candidate) => candidate.tabIndex >= 0 && !candidate.matches(":disabled") && candidate.closest("[inert], [hidden]") === null,
	);
}

function sourceGroup(direction: Direction, label: string) {
	return [...document.querySelectorAll(`[data-context-group="${direction}"] details`)].find(
		(details) => text(details.querySelector("summary")) === label,
	);
}

export function readingStructureVerbs(engine: ScreenEngine, tell: (line: string) => void) {
	function read<T>(line: string, value: () => T) {
		return Effect.sync(() => {
			tell(line);
			return value();
		});
	}
	function perform(line: string, action: () => void) {
		return Effect.gen(function* () {
			tell(line);
			yield* Effect.promise(() => act(async () => action()));
			yield* readingSettles(engine, tell);
		});
	}
	return {
		absentValueNotes: () =>
			read("the reader looks for notes about values the page does not have", () => {
				const shown = text(document.querySelector("main"));
				return ABSENT_VALUE_NOTES.filter((note) => shown.toLowerCase().includes(note.toLowerCase()));
			}),
		answerPanel: () =>
			read("the reader reads the answer panel", () => {
				const panel = document.querySelector(".response-panel");
				if (!panel) {
					return "none";
				}
				return {
					controls: [...panel.querySelectorAll("form, input, textarea, select, button, [role=radio], [role=checkbox]")].map((control) => {
						const { name, role } = accessibleOf(control);
						return `${role} ${name}`;
					}),
					notice: [...panel.querySelectorAll('[role="status"]')].map((status) => text(status)),
					options: [...panel.querySelectorAll("li")].map((option) => text(option)),
					question: text(panel.querySelector(".answer-reason")),
				};
			}),
		boardSummary: () =>
			read("the reader reads the board's summary under the title", () => {
				const summary = document.querySelector("[data-page-summary]");
				const updated = summary?.querySelector("[data-item-updated]");
				return {
					counts: text(summary?.querySelector(".counts")) || "none",
					updated: updated ? text(updated).replace(text(updated.querySelector("time")), "<time>") : "none",
				};
			}),
		focusPlace: () =>
			read("the reader checks which part of the page holds keyboard focus", () => {
				const focused = document.activeElement;
				if (!focused || focused === document.body) {
					return "nothing";
				}
				if (focused.closest("article.doc")) {
					return "the document text";
				}
				return focused.closest("#doc") ? "elsewhere on the page" : "outside the page";
			}),
		followDocumentLink: (name: string) =>
			Effect.gen(function* () {
				const link = [...document.querySelectorAll<HTMLAnchorElement>("article.doc a[href]")].find((candidate) => text(candidate) === name);
				if (!link) {
					return yield* Effect.die(new Error(`The document text has no ${name} link`));
				}
				yield* perform(`the reader follows the ${name} link in the document text`, () => {
					// The browser resolves the link against the address bar, which the story's in-memory router does not move.
					window.history.replaceState(window.history.state, "", engine.router?.state.location.href);
					link.focus();
					link.click();
				});
			}),
		itemContextTabs: () =>
			read("the reader reads the tabs of the item context", () => {
				const context = document.querySelector(".item-context");
				if (!context) {
					return "no item context";
				}
				const tabs = [...context.querySelectorAll('[role="tab"]')];
				return tabs.length === 0
					? "no tabs"
					: { selected: text(tabs.find((tab) => tab.getAttribute("aria-selected") === "true")), tabs: tabs.map((tab) => text(tab)) };
			}),
		itemHeaderRow: () =>
			read("the reader reads the item header row from left to right", () =>
				[...document.querySelectorAll(".item-summary > div > :is(span, a, button)")].map((part) => text(part) || accessibleOf(part).name),
			),
		landmarks: () =>
			read("the reader lists the page's named landmarks", () =>
				[...(page()?.querySelectorAll(":is(section, aside, nav, [role])") ?? [])].flatMap((element) => landmarkName(element) ?? []),
			),
		notesBoard: () =>
			read("the reader reads the notes board", () => {
				const board = document.querySelector(".document-layout > .board");
				if (!board) {
					return "none";
				}
				return {
					columns: [...board.querySelectorAll("section")].map((column) => ({
						column: text(column.querySelector("h2")),
						items: [...column.querySelectorAll("article.item")].map((item) => ({
							item: text(item.querySelector("h3")),
							text: text(item.querySelector("p")),
						})),
					})),
					introduction: text(board.querySelector(".board-introduction")),
				};
			}),
		openSourceGroup: (direction: Direction, label: string) =>
			Effect.gen(function* () {
				const details = sourceGroup(direction, label);
				if (!(details instanceof HTMLDetailsElement)) {
					return yield* Effect.die(new Error(`${direction} has no ${label} group`));
				}
				yield* perform(`the reader opens ${label} under ${direction}`, () => {
					details.open = true;
					details.dispatchEvent(new Event("toggle"));
				});
			}),
		pageHeader: () => read("the reader reads the page header", () => text(document.querySelector("[data-page-header]"))),
		pageMentions: (phrase: string) =>
			read(`the reader looks for "${phrase}" on the page`, () =>
				text(document.querySelector("main")).includes(phrase) ? "mentioned" : "not mentioned",
			),
		sourceGroup: (direction: Direction, label: string) =>
			read(`the reader reads the ${label} group under ${direction}`, () => {
				const details = sourceGroup(direction, label);
				if (!(details instanceof HTMLDetailsElement)) {
					return "none";
				}
				return details.open
					? [...details.querySelectorAll("a[href]")].flatMap((link) => link.getAttribute("href") ?? []).sort(Order.String)
					: "closed";
			}),
		tabOrder: () =>
			read("the reader tabs through the page and notes each landmark the focus passes", () =>
				tabStops()
					.map(landmarkOf)
					.filter((landmark, index, all) => landmark !== all[index - 1]),
			),
		tabStopsIn: (landmark: string) =>
			read(`the reader tabs through ${landmark}`, () =>
				tabStops()
					.filter((stop) => landmarkOf(stop) === landmark)
					.map((stop) => {
						const { name, role } = accessibleOf(stop);
						return `${role} ${name}`;
					}),
			),
	};
}
