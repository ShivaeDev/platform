import { Effect } from "effect";
import { act } from "react";
import type { ScreenEngine } from "./screenEngine.ts";
import { screenSettles } from "./screenSettle.ts";

function closedCard() {
	return document.querySelector<HTMLElement>("[data-closed-draft]");
}

export function closedDraftVerbs(engine: ScreenEngine, tell: (line: string) => void) {
	function read<T>(line: string, value: () => T) {
		return Effect.sync(() => {
			tell(line);
			return value();
		});
	}
	return {
		clipboardText: () =>
			Effect.sync(() => tell("the reader pastes what the clipboard holds")).pipe(
				Effect.andThen(Effect.promise(() => navigator.clipboard.readText())),
			),
		closedDraft: () =>
			read("the reader reads the closed draft card", () => {
				const card = closedCard();
				if (!card) {
					return "none";
				}
				const text = card.querySelector("textarea");
				return {
					notice: card.querySelector("p[role='status']:not([data-copy-status])")?.textContent,
					text: text?.value,
					textEditable: text ? !text.readOnly : false,
					title: card.querySelector("h2")?.textContent,
				};
			}),
		closedDraftCopy: () =>
			read("the reader reads the closed draft's copy status and selection", () => {
				const text = closedCard()?.querySelector("textarea");
				return {
					focused: text !== undefined && document.activeElement === text,
					selection: [text?.selectionStart, text?.selectionEnd],
					status: closedCard()?.querySelector("[data-copy-status]")?.textContent,
				};
			}),
		copyClosedDraft: () =>
			Effect.gen(function* () {
				tell("the reader presses Copy draft");
				const button = closedCard()?.querySelector("button");
				if (!button) {
					return yield* Effect.die(new Error("The closed draft card has no Copy draft button"));
				}
				yield* Effect.promise(() =>
					act(() => {
						button.click();
						return Promise.resolve();
					}),
				);
				yield* screenSettles(engine, tell);
			}),
	};
}
