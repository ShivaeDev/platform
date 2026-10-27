import { expect } from "vitest";
import { eventually } from "@shivaedev/react/client/testing.ts";
import { headerScreen } from "#test/headerScreen.tsx";
import { screenStory } from "#test/screenStory.ts";
import { shellIds } from "./shellIds.ts";

const labels = new Map<number | null | undefined, { readonly badge: string; readonly text: string }>([
	[0, { badge: "0 need you", text: "0" }],
	[4, { badge: "4 need you", text: "4" }],
	[null, { badge: "Needs you unavailable", text: "?" }],
	[undefined, { badge: "Counting what needs you", text: "" }],
]);
for (const [count, label] of labels) {
	screenStory.it(
		`names the Sidebar button and the Today link independently of responsive text and count ${count}`,
		[headerScreen(count)],
		({ control, roles }) => {
			expect(roles.accessible(`#${shellIds.sidebarToggle}`)).toEqual({ name: "Sidebar", role: "button" });
			expect(roles.text({ name: "Sidebar", role: "button" })).toBe("");
			expect(() => roles.text({ name: "Files", role: "button" })).toThrow(/has 0 matches/u);
			expect(control(`#${shellIds.inboxTopbarCount}`, HTMLElement).textContent).toBe(label.text);
			expect(control(`#${shellIds.inboxTopbar}`, HTMLAnchorElement).hasAttribute("role")).toBe(false);
			expect(control(`#${shellIds.inboxTopbar}`, HTMLAnchorElement).getAttribute("aria-label")).toBe(
				typeof count === "number" ? `Today, ${count} need you` : "Today",
			);
			expect(control(`#${shellIds.inboxTopbarCount}`, HTMLElement).getAttribute("aria-label")).toBe(label.badge);
		},
	);
}

screenStory.it("shows a spinner instead of a count while the count is still loading", [headerScreen(undefined)], ({ control }) => {
	expect(control(`#${shellIds.inboxTopbarCount}`, HTMLElement).querySelector("svg.animate-spin")).not.toBeNull();
});

screenStory.it("shows the header's Today link only while the desktop sidebar is hidden", [headerScreen(3)], function* ({ control, roles }) {
	const today = control(`#${shellIds.inboxTopbar}`, HTMLAnchorElement);
	const toggle = control(`#${shellIds.sidebarToggle}`, HTMLButtonElement);
	expect(toggle.getAttribute("aria-expanded")).toBe("true");
	expect(today.hidden).toBe(true);
	yield* roles.click({ name: "Sidebar", role: "button" });
	yield* eventually(() => expect(toggle.getAttribute("aria-expanded")).toBe("false"));
	expect(today.hidden).toBe(false);
});
