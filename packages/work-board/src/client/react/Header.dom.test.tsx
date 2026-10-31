import { expect } from "vitest";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { headerScreen } from "#test/headerScreen.tsx";
import { screenStory } from "#test/screenStory.ts";

for (const { badge, count, name, shown } of [
	{ badge: "0 need you", count: 0, name: "Today, 0 need you", shown: "0" },
	{ badge: "4 need you", count: 4, name: "Today, 4 need you", shown: "4" },
	{ badge: "Needs you unavailable", count: null, name: "Today", shown: "?" },
	{ badge: "Counting what needs you", count: undefined, name: "Today", shown: "spinner" },
]) {
	screenStory.it(
		`with a needs-you count of ${count}, the header's Today link is named ${JSON.stringify(name)} and its badge says ${JSON.stringify(badge)} and shows ${shown}`,
		[headerScreen(count)],
		function* ({ todayLink }) {
			expect(yield* todayLink()).toEqual({ badge, count: shown, name });
		},
	);
}

screenStory.it("the header's Sidebar button is named Sidebar without visible text", [headerScreen(3)], function* ({ sidebarButton }) {
	expect(yield* sidebarButton()).toMatchObject({ name: "Sidebar", visibleText: "" });
});

screenStory.it(
	"hiding the desktop sidebar collapses the Sidebar button and shows the header's Today link",
	[headerScreen(3)],
	function* ({ sidebarButton, todayLinkShown, toggleSidebar }) {
		yield* outcomes({
			"sidebar expanded": [sidebarButton(), expect.objectContaining({ expanded: "true" })],
			"Today link": [todayLinkShown(), "hidden"],
		});

		yield* toggleSidebar();

		yield* outcomes({
			"sidebar expanded": [sidebarButton(), expect.objectContaining({ expanded: "false" })],
			"Today link": [todayLinkShown(), "shown"],
		});
	},
);
