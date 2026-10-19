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
		({ control, roles }) => {
			expect(roles.accessible(`#${shellIds.sidebarToggle}`)).toEqual({ name: "Sidebar", role: "button" });
			expect(roles.text({ name: "Sidebar", role: "button" })).toBe("");
			expect(() => roles.text({ name: "Files", role: "button" })).toThrow(/has 0 matches/u);
			expect(control(`#${shellIds.inboxTopbarCount}`, HTMLElement).textContent).toBe(count === null ? "?" : String(count));
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

screenStory.it("shows the header's Today link only while the desktop sidebar is hidden", [headerScreen(3)], function* ({ control, roles }) {
	const today = control(`#${shellIds.inboxTopbar}`, HTMLAnchorElement);
	const toggle = control(`#${shellIds.sidebarToggle}`, HTMLButtonElement);
	expect(toggle.getAttribute("aria-expanded")).toBe("true");
	expect(today.hidden).toBe(true);
	yield* roles.click({ name: "Sidebar", role: "button" });
	yield* Effect.promise(() => eventually(() => expect(toggle.getAttribute("aria-expanded")).toBe("false")));
	expect(today.hidden).toBe(false);
});
