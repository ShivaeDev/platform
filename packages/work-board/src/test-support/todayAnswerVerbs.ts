import { Effect } from "effect";
import { act } from "react";
import { screenDriver } from "@shivaedev/test-story/server/screenDriver.ts";
import { appliedReceipt } from "./answeredDecisionFixture.ts";
import type { ScreenEngine } from "./screenEngine.ts";
import { screenSettles } from "./screenSettle.ts";
import { setNativeValue } from "./setNativeValue.ts";

const DIALOG = "[role='dialog']";

function askLink(title: string) {
	const links = [...document.querySelectorAll<HTMLAnchorElement>("[data-attention-row] a[title]")];
	const link = links.find((candidate) => candidate.title === title);
	if (!link) {
		throw new Error(`Today lists no ask titled ${title}; it lists ${JSON.stringify(links.map((candidate) => candidate.title))}`);
	}
	return link;
}

function lane(card: HTMLElement) {
	let section = card.closest("section[aria-label]");
	while (section?.getAttribute("aria-label") === "Lane items") {
		section = section.parentElement?.closest("section[aria-label]") ?? null;
	}
	return section?.getAttribute("aria-label");
}

function required<T>(found: T | null | undefined, name: string): T {
	if (found === null || found === undefined) {
		throw new Error(`The Today answer has no ${name}`);
	}
	return found;
}

function dialog() {
	const open = document.querySelector<HTMLElement>(DIALOG);
	if (!open) {
		throw new Error("No Today answer is open");
	}
	return open;
}

export function todayAnswerVerbs(engine: ScreenEngine, tell: (line: string) => void) {
	const { accessible } = screenDriver({ root: () => document.body, tell: () => undefined });
	function settle() {
		return screenSettles(engine, tell);
	}
	// Base UI places popover focus and Board pages place answer focus in an animation frame after the work settles.
	function nextFrame() {
		return Effect.sync(() => tell("the browser draws the next frame, where the page places focus")).pipe(
			Effect.andThen(Effect.promise(() => act(() => new Promise<void>((resolve) => requestAnimationFrame(() => resolve()))))),
			Effect.andThen(settle()),
		);
	}
	function perform(line: string, action: () => void) {
		return Effect.sync(() => tell(line)).pipe(
			Effect.andThen(Effect.promise(() => act(async () => action()))),
			Effect.andThen(settle()),
			Effect.andThen(nextFrame()),
		);
	}
	function read<T>(line: string, value: () => T) {
		return Effect.sync(() => {
			tell(line);
			return value();
		});
	}
	function named<T extends HTMLElement>(within: ParentNode, selector: string, name: string) {
		const candidates = [...within.querySelectorAll<T>(selector)];
		const found = candidates.find((candidate) => accessible(candidate).name === name);
		if (!found) {
			throw new Error(`No ${selector} named ${name}; found ${JSON.stringify(candidates.map((candidate) => accessible(candidate).name))}`);
		}
		return found;
	}
	return {
		answerOnToday: (title: string) =>
			perform(`the reader presses Answer beside ${title} on Today`, () => named(document, "button", `Answer ${title}`).click()),
		chooseOnToday: (option: string) => perform(`the reader chooses ${option} in the Today answer`, () => named(dialog(), "button", option).click()),
		closeTodayAnswer: () =>
			perform("the reader presses Escape to close the Today answer", () =>
				(document.activeElement ?? document).dispatchEvent(new KeyboardEvent("keydown", { bubbles: true, key: "Escape" })),
			),
		expandTodayContext: () =>
			perform("the reader expands the question's context in the Today answer", () =>
				required(dialog().querySelector<HTMLElement>("[data-slot='collapsible-trigger']"), "context toggle").click(),
			),
		fleetAppliesAnswer: (answer?: string) =>
			Effect.sync(() => {
				tell(`Fleet records that it applied ${answer ?? "the answer"}`);
				Object.assign(engine.files, answer === undefined ? appliedReceipt() : appliedReceipt(answer));
			}),
		followFullQuestion: () =>
			perform("the reader follows Read the full question", () => named<HTMLAnchorElement>(dialog(), "a", "Read the full question").click()),
		gettingStarted: () =>
			read("the reader looks for Getting started under Needs you", () =>
				document.querySelector("#needs-you a[href='/_board/start']") === null ? "not offered" : "offered",
			),
		needsYou: () =>
			read("the reader reads Needs you on Today", () => {
				const section = document.querySelector("#needs-you");
				const rows = [...(section?.querySelectorAll<HTMLAnchorElement>("ul[aria-label='Needs you'] > li a[title]") ?? [])];
				if (rows.length > 0) {
					return rows.map((row) => row.title);
				}
				return (section?.querySelector("[data-slot='empty-title']") ?? section?.querySelector(":scope > p[role='status']"))?.textContent ?? "missing";
			}),
		needsYouNotice: () =>
			read("the reader reads the notice under Needs you", () => document.querySelector("#needs-you [role='status']")?.textContent ?? "none"),
		openTodayAsk: (title: string) => perform(`the reader opens the Today ask ${title}`, () => askLink(title).click()),
		phoneNavigation: () =>
			read("the reader looks for the phone navigation", () => {
				const nav = document.querySelector<HTMLElement>('nav[aria-label="Phone navigation"]');
				if (nav === null) {
					return "missing";
				}
				return nav.hidden ? "hidden" : "shown";
			}),
		recordOnToday: () => perform("the reader records the Today answer", () => named(dialog(), "button", "Record answer").click()),
		todayAnswer: () =>
			read("the reader looks at the Today answer", () => {
				const open = document.querySelector<HTMLElement>(DIALOG);
				if (!open) {
					return "closed";
				}
				return {
					name: accessible(open).name,
					shape: open.dataset.slot === "sheet-content" ? `${open.dataset.side} sheet` : "popover",
					status: open.querySelector("[role='status']")?.textContent ?? "none",
				};
			}),
		todayAnswerLimit: (label = "Your answer") =>
			read(`the reader checks how long ${label} may be`, () => named<HTMLTextAreaElement>(dialog(), "textarea", label).maxLength),
		todayAnswerPanel: () =>
			read("the reader reads the Today answer from top to bottom", () => {
				const open = dialog();
				const group = open.querySelector("fieldset");
				const trigger = open.querySelector<HTMLElement>("[data-slot='collapsible-trigger']");
				const parts = [
					{ found: group?.querySelector("textarea"), name: "answer box" },
					{ found: group?.querySelector("button:not([type='submit'], [data-slot='collapsible-trigger'])"), name: "options" },
					{ found: trigger, name: `${trigger?.textContent} (${trigger?.getAttribute("aria-expanded") === "true" ? "expanded" : "collapsed"})` },
					{ found: [...open.querySelectorAll("a")].find((link) => link.textContent === "Read the full question"), name: "Read the full question" },
				].filter((part): part is { found: Element; name: string } => part.found !== null && part.found !== undefined);
				return {
					group: group ? accessible(group).name : "none",
					order: parts
						.sort((left, right) => (left.found.compareDocumentPosition(right.found) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1))
						.map(({ name }) => name),
					text: open.textContent ?? "",
				};
			}),
		todayAnswerText: (label = "Your answer") =>
			read(`the reader reads ${label} in the Today answer`, () => named<HTMLTextAreaElement>(dialog(), "textarea", label).value),
		todayAskHref: (title: string) => read(`the reader reads where the Today ask ${title} leads`, () => askLink(title).getAttribute("href")),
		todayCounts: () =>
			read("the reader counts Needs you and reads its badges in the sidebar, header and phone navigation", () => ({
				header: document.querySelector("#inbox-topbar-count")?.textContent ?? "none",
				"Needs you": document.querySelectorAll("#needs-you ul[aria-label='Needs you'] > li").length,
				phone: document.querySelector('nav[aria-label="Phone navigation"] a[href="/"] [data-slot="badge"]')?.textContent ?? "none",
				sidebar: document.querySelector("#inbox-count")?.textContent ?? "none",
			})),
		todayHiddenDraft: () =>
			read("the reader reads what else the Today answer will send", () => {
				const hidden = document.querySelector(`${DIALOG} [data-hidden-draft]`);
				return hidden === null ? "none" : { link: hidden.querySelector("a")?.getAttribute("href"), text: hidden.textContent };
			}),
		todayOptions: () =>
			read("the reader reads the options in the Today answer", () =>
				[...dialog().querySelectorAll<HTMLButtonElement>("fieldset button:not([data-slot='collapsible-trigger'])")].map(
					(button) => `${accessible(button).name}${button.disabled ? " (disabled)" : ""}`,
				),
			),
		todaySummary: () => read("the reader reads the Today summary", () => document.querySelector(".today-strip")?.textContent ?? "missing"),
		workCard: (item: string) =>
			read(`the reader finds ${item} on Now`, () => {
				const card = document.querySelector<HTMLElement>(`[data-item='${item}']`);
				if (!card) {
					return "missing";
				}
				return {
					answer: card.querySelector(".work-answer")?.textContent ?? "none",
					lane: lane(card),
					owner: card.querySelector(".work-owner")?.textContent ?? "none",
					status: card.querySelector("[data-status-token]")?.textContent,
				};
			}),
		writeOnToday: (text: string, label = "Your answer") =>
			perform(`the reader writes ${JSON.stringify(text)} in ${label} on Today`, () => {
				const box = named<HTMLTextAreaElement>(dialog(), "textarea", label);
				setNativeValue(box, text);
				box.dispatchEvent(new Event("input", { bubbles: true }));
			}),
	};
}
