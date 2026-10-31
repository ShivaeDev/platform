import { Effect } from "effect";
import { act } from "react";
import { screenDriver } from "@shivaedev/test-story/server/screenDriver.ts";
import type { ScreenEngine } from "./screenEngine.ts";
import { screenSettles } from "./screenSettle.ts";

export function shellElement<E extends Element = HTMLElement>(selector: string, what = selector) {
	const found = document.querySelector<E>(selector);
	if (!found) {
		throw new Error(`The screen has no ${what}`);
	}
	return found;
}

export function shellActs(engine: ScreenEngine, tell: (line: string) => void) {
	return {
		acting: (line: string, action: () => void | Promise<void>) =>
			Effect.gen(function* () {
				tell(line);
				yield* Effect.promise(() => act(async () => action()));
				yield* screenSettles(engine, tell);
			}),
		reading: <T>(line: string, read: () => T) =>
			Effect.sync(() => {
				tell(line);
				return read();
			}),
	};
}

export function accessibleOf(element: Element) {
	return screenDriver({ root: () => document.body, tell: () => undefined }).accessible(element);
}

export function pressKey(target: EventTarget, key: string, init: KeyboardEventInit = {}) {
	const event = new KeyboardEvent("keydown", { bubbles: true, cancelable: true, ...init, key });
	target.dispatchEvent(event);
	return event;
}
