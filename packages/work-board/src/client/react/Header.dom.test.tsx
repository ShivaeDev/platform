import { expect } from "vitest";
import { headerScreen } from "#test/headerScreen.tsx";
import { screenStory } from "#test/screenStory.ts";
import { shellIds } from "./shellIds.ts";

for (const count of [0, 4, null]) {
	screenStory.it(
		`names the Files button and the Today link independently of responsive text and count ${count}`,
		[headerScreen(count)],
		({ control }) => {
			expect(control(`#${shellIds.inboxTopbarCount}`, HTMLElement).textContent).toBe(count === null ? "?" : String(count));
			expect(control(`#${shellIds.sidebarToggle}`, HTMLButtonElement).getAttribute("aria-label")).toBe("Files");
			expect(control(`#${shellIds.inboxTopbar}`, HTMLAnchorElement).hasAttribute("role")).toBe(false);
			expect(control(`#${shellIds.inboxTopbar}`, HTMLAnchorElement).getAttribute("aria-label")).toBe(
				count === null ? "Today" : `Today, ${count} need you`,
			);
			expect(control(`#${shellIds.inboxTopbarCount}`, HTMLElement).getAttribute("aria-label")).toBe(
				count === null ? "Needs you unavailable" : `${count} need you`,
			);
		},
	);
}
