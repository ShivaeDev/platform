import { expect } from "vitest";
import { expectNoReactWarnings } from "@shivaedev/test-story/client/react.ts";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { screenMedia } from "#test/screenEnvironment.ts";
import { screenStory } from "#test/screenStory.ts";
import { chromeScreen } from "#test/screenTraits.ts";
import { phoneTabList } from "#test/shellExpectations.ts";
import { hostedHealthSettled } from "#test/shellTraits.tsx";
import { todayFixture } from "#test/todayFixture.ts";

expectNoReactWarnings();

const phone = screenMedia(["(max-width: 767px)", "(any-pointer: coarse)"]);

for (const [url, current] of [
	["/", "/"],
	["/_board/work", "/_board/work"],
	["/_board/item/project.alpha/", undefined],
	["/home.md", undefined],
] as const) {
	screenStory.it(`offers the Today, Goals and Now tabs on a phone at ${url}`, [phone, chromeScreen(todayFixture(), url)], function* ({ phoneTabs }) {
		expect(yield* phoneTabs()).toEqual(phoneTabList(current));
	});
}

screenStory.it(
	"opens Search from the phone navigation without keyboard hints",
	[phone, chromeScreen(todayFixture(), "/")],
	function* ({ openPhoneSearch, searchDialog, searchHints }) {
		expect(yield* searchDialog()).toBe("closed");

		yield* openPhoneSearch();

		yield* outcomes({
			"Search": [searchDialog(), "open"],
			"the keyboard hints": [searchHints(), "none"],
		});
	},
);

for (const [tab, href, heading] of [
	["Goals", "/_board/goals", "Goals"],
	["Now", "/_board/work", "Now"],
	["Today", "/", "Today"],
] as const) {
	screenStory.it(
		`opens ${heading} from its phone tab and marks the tab current`,
		[phone, chromeScreen(todayFixture(), "/home.md")],
		function* ({ mainHeading, openPhoneTab, phoneTabs }) {
			expect(yield* phoneTabs()).toEqual(phoneTabList());

			yield* openPhoneTab(tab);

			yield* outcomes({
				"the heading": [mainHeading(), heading],
				"the tabs": [phoneTabs(), phoneTabList(href)],
			});
		},
	);
}

for (const [name, href] of [
	["Pull requests", "/_board/pull-requests"],
	["Library", "/_board/library"],
	["System", "/_board/system"],
] as const) {
	screenStory.it(
		`opens ${name} from the phone's More sheet and closes the sheet`,
		[phone, chromeScreen(todayFixture(), "/")],
		function* ({ chooseInMore, currentPage, moreSheet, openMore }) {
			yield* openMore();
			expect(yield* moreSheet()).toEqual(expect.objectContaining({ destinations: ["Pull requests", "Library", "System"] }));

			yield* chooseInMore(name);

			yield* outcomes({
				"More": [moreSheet(), "closed"],
				"the page": [currentPage(), href],
			});
		},
	);
}

screenStory.it(
	"closes the phone's More sheet with its Close button",
	[phone, chromeScreen(todayFixture(), "/")],
	function* ({ closeMore, moreSheet, openMore }) {
		yield* openMore();
		expect(yield* moreSheet()).not.toBe("closed");

		yield* closeMore();

		expect(yield* moreSheet()).toBe("closed");
	},
);

screenStory.it(
	"opens Settings with its Theme choices on a phone",
	[phone, chromeScreen(todayFixture(), "/")],
	function* ({ appearanceChoices, openSettings, settingsPanel }) {
		expect(yield* settingsPanel()).toBe("closed");

		yield* openSettings();

		yield* outcomes({
			"Settings": [settingsPanel(), "open"],
			"the pressed choices": [appearanceChoices(), expect.arrayContaining(["System"])],
		});
	},
);

screenStory.it(
	"keeps the phone's live status empty while the connection is still connecting",
	[phone, hostedHealthSettled("connecting")],
	function* ({ liveIndicator }) {
		expect(yield* liveIndicator()).toEqual({ announced: "", icon: "none", role: "status", shown: "", state: "connecting" });
	},
);

screenStory.it(
	"tells a phone reader with an icon that the connection is reconnecting",
	[phone, hostedHealthSettled()],
	function* ({ liveIndicator }) {
		expect(yield* liveIndicator()).toEqual({ announced: "Reconnecting…", icon: "shown", role: "status", shown: "Reconnecting…", state: "down" });
	},
);

screenStory.it(
	"tells a phone reader that the page couldn't update once the host's page fails to refresh",
	[phone, hostedHealthSettled()],
	function* ({ hostShowsUnreadableDocument, liveIndicator }) {
		expect((yield* liveIndicator()).announced).toBe("Reconnecting…");

		yield* hostShowsUnreadableDocument();

		expect(yield* liveIndicator()).toEqual(expect.objectContaining({ announced: "Couldn't update this page", shown: "Not updated" }));
	},
);

screenStory.it("tells a phone reader that updates are paused", [phone, hostedHealthSettled("live", "paused")], function* ({ liveIndicator }) {
	expect(yield* liveIndicator()).toEqual({
		announced: "Updates paused · 0 pending",
		icon: "shown",
		role: "status",
		shown: "Paused",
		state: "paused",
	});
});
