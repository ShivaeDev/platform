import type * as Effect from "effect/Effect";
import type { screenElements } from "#server/adapters/screenElements.ts";
import type { ScreenTarget } from "#server/screenDriver.ts";
import { targetName } from "./targetName.ts";

export function screenInteractions(elements: ReturnType<typeof screenElements>, perform: (line: string, action: () => void) => Effect.Effect<void>) {
	return {
		blur: (target: ScreenTarget) => perform(`blur ${targetName(target)}`, () => elements.element(target).blur()),
		focus: (target: ScreenTarget) =>
			perform(`focus ${targetName(target)}`, () => {
				const element = elements.element(target);
				elements.enabled(element, target);
				element.focus();
			}),
		hover: (target: ScreenTarget) =>
			perform(`hover over ${targetName(target)}`, () => {
				const element = elements.element(target);
				for (const type of ["pointerover", "pointerenter", "mouseover", "mouseenter", "pointermove", "mousemove"]) {
					const init = { bubbles: !type.endsWith("enter"), pointerType: "mouse" };
					element.dispatchEvent(type.startsWith("pointer") ? new PointerEvent(type, init) : new MouseEvent(type, init));
				}
			}),
		pressKey: (target: ScreenTarget, key: string, options: KeyboardEventInit = {}) =>
			perform(`press ${JSON.stringify(key)} on ${targetName(target)}`, () => {
				const element = elements.element(target);
				for (const type of ["keydown", "keyup"]) {
					element.dispatchEvent(new KeyboardEvent(type, { bubbles: true, cancelable: true, ...options, key }));
				}
			}),
	};
}
