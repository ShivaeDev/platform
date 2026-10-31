import { Effect } from "effect";
import { act } from "react";
import type { ScreenEngine } from "./screenEngine.ts";
import { screenSettles } from "./screenSettle.ts";

const HEADER = ".item-summary";

function header() {
	return document.querySelector<HTMLElement>(HEADER);
}

export function itemWaitingVerbs(engine: ScreenEngine, tell: (line: string) => void) {
	function read<T>(line: string, value: () => T) {
		return Effect.sync(() => {
			tell(line);
			return value();
		});
	}
	return {
		answerJump: () =>
			read("the reader looks for the Answer control in the item header", () => header()?.querySelector("[data-answer-jump]")?.textContent ?? "none"),
		itemHeaderText: () => read("the reader reads the item header", () => header()?.textContent ?? "none"),
		nextActionMentions: () =>
			read("the reader reads the items and files the next action names", () =>
				[...(header()?.querySelectorAll<HTMLElement>("[data-mention]") ?? [])].map((mention) => {
					const link = mention.querySelector("a");
					const status = mention.querySelector("[data-status-token]")?.textContent;
					return `${link?.textContent} -> ${link?.getAttribute("href")}${status ? ` (${status})` : ""}`;
				}),
			),
		nextActionPullRequests: () =>
			read("the reader reads the pull request links in the item header", () =>
				[...(header()?.querySelectorAll<HTMLAnchorElement>('a[href*="/pull/"]') ?? [])].map(
					(link) => `${link.textContent} -> ${link.getAttribute("href")}`,
				),
			),
		pressAnswerJump: () =>
			Effect.gen(function* () {
				tell("the reader presses Answer in the item header");
				const jump = header()?.querySelector<HTMLElement>("[data-answer-jump]");
				if (!jump) {
					return yield* Effect.die(new Error("The item header has no Answer control"));
				}
				yield* Effect.promise(() =>
					act(() => {
						jump.click();
						return Promise.resolve();
					}),
				);
				yield* screenSettles(engine, tell);
				// The page moves focus to the answer box in an animation frame after scrolling to it.
				yield* Effect.promise(() => act(() => new Promise<void>((resolve) => requestAnimationFrame(() => resolve()))));
				yield* screenSettles(engine, tell);
			}),
		waitingRows: () =>
			read("the reader reads who the item is waiting on", () =>
				[...(header()?.querySelectorAll<HTMLElement>("[data-waiting-on]") ?? [])].map((row) => ({
					highlighted: row.className.includes("needs-you"),
					links: [...row.querySelectorAll("a")].map(
						(link) => `${link.getAttribute("aria-label") ?? link.textContent} -> ${link.getAttribute("href")}`,
					),
					text: row.textContent,
				})),
			),
	};
}
