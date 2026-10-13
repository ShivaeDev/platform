import { Effect } from "effect";
import type { OpenPage } from "./browser.ts";

export function formEvent(page: OpenPage, event: () => void) {
	return Effect.promise(
		() =>
			new Promise<void>((resolve) => {
				event();
				page.window.requestAnimationFrame(() => resolve());
			}),
	);
}
