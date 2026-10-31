import { Effect } from "effect";
import { act } from "react";
import { vi } from "vitest";
import type { ScreenEngine } from "./screenEngine.ts";
import { screenSettles } from "./screenSettle.ts";

// Base UI's Popover opens on hover only after its own hover delay, which a story under fake timers has to pass.
const POPOVER_HOVER_DELAY_MS = 1000;

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

async function hover(button: HTMLElement) {
	for (const type of ["pointerover", "pointerenter", "mouseover", "mouseenter", "pointermove", "mousemove"]) {
		const init = { bubbles: !type.endsWith("enter"), pointerType: "mouse" };
		button.dispatchEvent(type.startsWith("pointer") ? new PointerEvent(type, init) : new MouseEvent(type, init));
	}
	await vi.advanceTimersByTimeAsync(POPOVER_HOVER_DELAY_MS);
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

const OPENINGS = { hover, keyboard: press, tap };

export function timeScreenVerbs(engine: ScreenEngine, tell: (line: string) => void) {
	function acts(line: string, action: () => Promise<void>) {
		return Effect.gen(function* () {
			tell(line);
			yield* Effect.promise(() => act(action));
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
				() => OPENINGS[how](trigger()),
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
