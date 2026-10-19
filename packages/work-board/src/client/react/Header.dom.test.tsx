import { Effect } from "effect";
import { expect } from "vitest";
import { eventually } from "@shivaedev/effect-react/client/testing.ts";
import { headerScreen } from "#test/headerScreen.tsx";
import { screenStory } from "#test/screenStory.ts";
import { shellIds } from "./shellIds.ts";

for (const count of [0, 4, null]) {
	screenStory.it(
		`names the Sidebar button and the Today link independently of responsive text and count ${count}`,
		[headerScreen(count)],
		({ control, findByRole }) => {
			const toggle = findByRole("button", "Sidebar");
			expect(toggle?.id).toBe(shellIds.sidebarToggle);
			expect(toggle?.textContent).toBe("");
			expect(findByRole("button", "Files")).toBeNull();
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

screenStory.it("shows the header's Today link only while the desktop sidebar is hidden", [headerScreen(3)], function* ({ click, control, findByRole }) {
	const today = control(`#${shellIds.inboxTopbar}`, HTMLAnchorElement);
	expect(findByRole("button", "Sidebar")?.getAttribute("aria-expanded")).toBe("true");
	expect(today.hidden).toBe(true);
	click(findByRole("button", "Sidebar"));
	yield* Effect.promise(() => eventually(() => expect(findByRole("button", "Sidebar")?.getAttribute("aria-expanded")).toBe("false")));
	expect(today.hidden).toBe(false);
});
