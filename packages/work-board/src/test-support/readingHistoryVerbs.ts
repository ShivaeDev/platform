import { Effect } from "effect";
import { act } from "react";
import { shellIds } from "#client/react/shellIds.ts";
import { readingSettles } from "./readingSettle.ts";
import type { ScreenEngine } from "./screenEngine.ts";

function text(element: Element | null | undefined) {
	return element?.textContent?.trim() ?? "";
}

function entry(item: Element) {
	const link = item.querySelector("a[href]");
	const read = item.querySelector("time")?.getAttribute("datetime");
	const details = [...(item.querySelector("a + span")?.children ?? [])].filter(
		(part) => part.getAttribute("aria-hidden") !== "true" && !part.querySelector("time"),
	);
	return [text(link), ...(read ? [`read ${read}`] : []), ...details.map(text)].join(" · ");
}

function button(label: string) {
	return [...document.querySelectorAll<HTMLButtonElement>(`#${shellIds.libraryDialog} button`)].find(
		(candidate) => candidate.getAttribute("aria-label") === label || text(candidate) === label,
	);
}

export function readingHistoryVerbs(engine: ScreenEngine, tell: (line: string) => void) {
	function click(line: string, label: string) {
		return Effect.gen(function* () {
			tell(line);
			const target = button(label);
			if (!target) {
				return yield* Effect.die(new Error(`Reading history has no ${label} button`));
			}
			yield* Effect.promise(() => act(async () => target.click()));
			yield* readingSettles(engine, tell);
		});
	}
	return {
		answerClearConfirmation: (choice: "Cancel" | "Clear") => click(`the reader answers the clear confirmation with ${choice}`, choice),
		clearConfirmation: () =>
			Effect.sync(() => {
				tell("the reader reads the clear confirmation in Reading history");
				return text(document.querySelector(`#${shellIds.libraryDialog} fieldset legend`)) || "none";
			}),
		clearHistory: () => click("the reader clicks Clear history", "Clear history"),
		historyDays: () =>
			Effect.sync(() => {
				tell("the reader reads each day in Reading history with when each entry was read, its kind and status");
				return Object.fromEntries(
					[...document.querySelectorAll(`#${shellIds.readingLibrary} ul[aria-labelledby]`)].map((list) => [
						text(document.getElementById(list.getAttribute("aria-labelledby") ?? "")),
						[...list.querySelectorAll("li")].map(entry),
					]),
				);
			}),
		removeFromHistory: (title: string) => click(`the reader removes ${title} from Reading history`, `Remove ${title} from history`),
	};
}
