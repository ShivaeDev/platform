import { expect } from "vitest";
import { expectNoReactWarnings } from "@shivaedev/test-story/client/react.ts";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { screenMedia } from "#test/screenEnvironment.ts";
import { screenStory } from "#test/screenStory.ts";
import { chromeScreen } from "#test/screenTraits.ts";
import { topicLinks } from "#test/shellExpectations.ts";
import { sidebarWorkspace } from "#test/sidebarFixture.ts";

expectNoReactWarnings();

const PHONE = ["(max-width: 767px)", "(any-pointer: coarse)"];
const DESTINATIONS = ["Today", "Goals", "Now", "Pull requests", "Library", "System"];

for (const phone of [false, true]) {
	const device = phone ? "phone" : "desktop";
	const workspace = [screenMedia(phone ? PHONE : []), chromeScreen(sidebarWorkspace(), "/notes/topic-1.md")];

	screenStory.it(
		`lists the five pages visited before the open one under Recent, newest first, and keeps the six destinations in place on ${device}`,
		workspace,
		function* ({ navigate, sidebarDestinations, sidebarLinks }) {
			for (const index of [2, 3, 4, 5]) {
				yield* navigate(`/notes/topic-${index}.md`);
			}
			expect(yield* sidebarLinks("Recent")).toEqual(topicLinks(4, 3, 2, 1));

			yield* navigate("/notes/topic-6.md");

			yield* outcomes({
				"Recent": [sidebarLinks("Recent"), topicLinks(5, 4, 3, 2, 1)],
				"the destinations": [sidebarDestinations(), DESTINATIONS.map((label) => expect.objectContaining({ label }))],
			});
		},
	);

	screenStory.it(
		`lists all six visited pages in Reading history, newest first, on ${device}`,
		workspace,
		function* ({ navigate, openReadingHistory, readingHistory, toggleSidebar }) {
			for (const index of [2, 3, 4, 5, 6]) {
				yield* navigate(`/notes/topic-${index}.md`);
			}
			if (phone) {
				yield* toggleSidebar();
			}
			expect(yield* readingHistory()).toEqual({});

			yield* openReadingHistory();

			expect(yield* readingHistory()).toEqual({ Today: ["Topic 6 (current)", "Topic 5", "Topic 4", "Topic 3", "Topic 2", "Topic 1"] });
		},
	);
}

const phoneShell = [screenMedia(PHONE), chromeScreen(sidebarWorkspace(), "/notes/topic-1.md")];
const closed = { focusInside: false, modal: false, pageInert: false, shown: false };
const covering = { focusInside: true, modal: true, pageInert: true, shown: true };

screenStory.it(
	"opens the phone sidebar as a modal over an inert page and moves focus into it",
	phoneShell,
	function* ({ sidebarPanel, toggleSidebar }) {
		expect(yield* sidebarPanel()).toEqual(closed);

		yield* toggleSidebar();

		expect(yield* sidebarPanel()).toEqual(covering);
	},
);

for (const how of ["Escape", "the backdrop"] as const) {
	screenStory.it(
		`closes the phone sidebar with ${how}, frees the page and returns focus to the Sidebar button`,
		phoneShell,
		function* ({ dismissSidebar, keyboardFocus, sidebarPanel, toggleSidebar }) {
			yield* toggleSidebar();
			expect(yield* sidebarPanel()).toEqual(covering);

			yield* dismissSidebar(how);

			yield* outcomes({
				"the focus": [keyboardFocus(), { name: "Sidebar", role: "button" }],
				"the sidebar": [sidebarPanel(), closed],
			});
		},
	);
}

screenStory.it("shows the sidebar as a plain panel once the screen widens past phone size", phoneShell, function* ({ setMediaMatch, sidebarPanel }) {
	expect((yield* sidebarPanel()).shown).toBe(false);

	yield* setMediaMatch("(max-width: 767px)", false);

	expect(yield* sidebarPanel()).toEqual({ ...closed, shown: true });
});

screenStory.it("hides the sidebar again once the screen narrows back to phone size", phoneShell, function* ({ setMediaMatch, sidebarPanel }) {
	yield* setMediaMatch("(max-width: 767px)", false);
	expect((yield* sidebarPanel()).shown).toBe(true);

	yield* setMediaMatch("(max-width: 767px)", true);

	expect(yield* sidebarPanel()).toEqual(closed);
});
