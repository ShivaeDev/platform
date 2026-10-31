import { expect } from "vitest";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { headerScreen } from "#test/headerScreen.tsx";
import { screenStory } from "#test/screenStory.ts";

screenStory.it(
	"opening Settings shows System and Comfortable pressed and focuses System",
	[headerScreen(0, true)],
	function* ({ appearanceChoices, keyboardFocus, openSettings, settingsPanel }) {
		expect(yield* settingsPanel()).toBe("closed");

		yield* openSettings();

		yield* outcomes({
			focus: [keyboardFocus(), { name: "System", role: "button" }],
			pressed: [appearanceChoices(), ["System", "Comfortable"]],
		});
	},
);

screenStory.it(
	"choosing Dark and Compact in Settings presses them and puts the page in the dark scheme at compact density",
	[headerScreen(0, true)],
	function* ({ appearanceChoices, chooseAppearance, openSettings, pageAppearance }) {
		yield* openSettings();
		expect(yield* pageAppearance()).toEqual({ density: "comfortable", scheme: "light" });

		yield* chooseAppearance("Dark");
		yield* chooseAppearance("Compact");

		yield* outcomes({
			page: [pageAppearance(), { density: "compact", scheme: "dark" }],
			pressed: [appearanceChoices(), ["Dark", "Compact"]],
		});
	},
);

screenStory.it(
	"choosing Light after Dark takes the page out of the dark scheme",
	[headerScreen(0, true)],
	function* ({ chooseAppearance, openSettings, pageAppearance }) {
		yield* openSettings();
		yield* chooseAppearance("Dark");
		expect((yield* pageAppearance()).scheme).toBe("dark");

		yield* chooseAppearance("Light");

		expect((yield* pageAppearance()).scheme).toBe("light");
	},
);

screenStory.it(
	"choosing the pressed theme again keeps it pressed instead of clearing the theme",
	[headerScreen(0, true)],
	function* ({ appearanceChoices, chooseAppearance, openSettings }) {
		yield* openSettings();
		yield* chooseAppearance("Light");
		expect(yield* appearanceChoices()).toEqual(["Light", "Comfortable"]);

		yield* chooseAppearance("Light");

		expect(yield* appearanceChoices()).toEqual(["Light", "Comfortable"]);
	},
);

screenStory.it(
	"Pause updates in Settings pauses live updates and relabels the toggle Resume updates",
	[headerScreen(0, true)],
	function* ({ openSettings, toggleUpdates, updatesToggle }) {
		yield* openSettings();
		expect(yield* updatesToggle()).toEqual({ label: "Pause updates", paused: false, pressed: "false" });

		yield* toggleUpdates();

		expect(yield* updatesToggle()).toEqual({ label: "Resume updates", paused: true, pressed: "true" });
	},
);

screenStory.it(
	"Escape closes Settings and returns focus to the Settings button",
	[headerScreen(0, true)],
	function* ({ keyboardFocus, keyboard, openSettings, settingsPanel }) {
		yield* openSettings();
		expect(yield* settingsPanel()).toBe("open");

		yield* keyboard("Escape");

		yield* outcomes({
			focus: [keyboardFocus(), { name: "Settings", role: "button" }],
			settings: [settingsPanel(), "closed"],
		});
	},
);
