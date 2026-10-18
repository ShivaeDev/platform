import { expect } from "vitest";
import { headerScreen } from "#test/headerScreen.tsx";
import { screenStory } from "#test/screenStory.ts";
import { shellIds } from "./shellIds.ts";

for (const count of [0, 4, null]) {
	screenStory.it(`names the Files and Today controls independently of responsive text and count ${count}`, [headerScreen(count)], ({ control }) => {
		expect(control(`#${shellIds.sidebarToggle}`, HTMLButtonElement).getAttribute("aria-label")).toBe("Files");
		expect(control(`#${shellIds.inboxTopbar}`, HTMLAnchorElement).getAttribute("aria-label")).toBe("Today");
		expect(control(`#${shellIds.inboxTopbarCount}`, HTMLElement).getAttribute("aria-label")).toBe(`${count ?? "?"} waiting`);
	});
}
