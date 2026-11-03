import { Effect } from "effect";
import { act } from "react";
import { screenDriver } from "@shivaedev/test-story/server/screenDriver.ts";
import { screenAct } from "./screenAct.ts";
import type { ScreenEngine } from "./screenEngine.ts";
import { screenSettles } from "./screenSettle.ts";

function shownTime() {
	const time = document.querySelector("time");
	if (!time) {
		throw new Error("The screen shows no time");
	}
	return time;
}

function trigger() {
	const button = shownTime().closest("button");
	if (!button) {
		throw new Error("The time opens no exact time");
	}
	return button;
}

async function tap(button: HTMLElement) {
	for (const type of ["pointerdown", "pointerup"]) {
		button.dispatchEvent(new PointerEvent(type, { bubbles: true, pointerType: "touch" }));
	}
	button.click();
	await Promise.resolve();
}

async function press(button: HTMLElement) {
	if (button.tabIndex < 0) {
		throw new Error("The time is not a Tab stop");
	}
	button.focus();
	button.click();
	await Promise.resolve();
}

const OPENINGS = { keyboard: press, tap };

export function timeScreenVerbs(engine: ScreenEngine, tell: (line: string) => void) {
	function acts(line: string, action: () => Promise<void>) {
		return Effect.gen(function* () {
			tell(line);
			yield* Effect.promise(() => act(action));
			yield* screenDriver({ act: screenAct, pending: () => false, root: () => document.body, tell }).find("[data-slot=popover-content]");
			yield* screenSettles(engine, tell);
		});
	}
	return {
		exactTimeShown: () =>
			Effect.sync(() => {
				tell("the reader reads the exact time the page shows beside the time");
				return document.querySelector("[data-slot=popover-content]")?.textContent ?? "closed";
			}),
		openExactTime: (how: "hover" | "keyboard" | "tap") =>
			acts(
				{ hover: "the reader points at the time", keyboard: "the reader tabs to the time and activates it", tap: "the reader taps the time" }[how],
				async () => {
					if (how === "hover") {
						await Effect.runPromise(screenDriver({ root: () => document.body, tell }).hover("button:has(time)"));
					} else {
						await OPENINGS[how](trigger());
					}
				},
			),
		timeShown: () =>
			Effect.sync(() => {
				tell("the reader reads the time and what it names");
				const time = shownTime();
				const reachable = time.closest<HTMLElement>("button, a, [tabindex]");
				return {
					datetime: time.getAttribute("datetime"),
					exact: time.getAttribute("title") ?? "on request",
					label: time.textContent,
					tabStop: reachable && reachable.tabIndex >= 0 ? "yes" : "no",
				};
			}),
	};
}
