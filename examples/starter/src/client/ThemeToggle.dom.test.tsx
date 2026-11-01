import { Effect } from "effect";
import { expect } from "vitest";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { screens } from "#test-support/screens.ts";

screens.it(
	"with no saved choice, the theme follows the system when it turns dark",
	[],
	function* ({ openThemeControl, systemTheme, themeAppearance, themeSelection }) {
		yield* openThemeControl();
		expect(themeAppearance()).toBe("light");

		yield* systemTheme(true);

		yield* outcomes([
			["selection", () => Effect.sync(themeSelection), "system"],
			["appearance", () => Effect.sync(themeAppearance), "dark"],
		]);
	},
);

for (const choice of ["dark", "light"] as const) {
	screens.it(
		`a ${choice} choice keeps its appearance when the system changes`,
		[],
		function* ({ chooseTheme, openThemeControl, systemTheme, themeAppearance }) {
			yield* openThemeControl();
			yield* chooseTheme(choice);
			expect(themeAppearance()).toBe(choice);

			yield* systemTheme(choice === "light");

			expect(themeAppearance()).toBe(choice);
		},
	);

	screens.it(
		`reopening the theme control restores a saved ${choice} choice`,
		[],
		function* ({ chooseTheme, closeThemeControl, openThemeControl, savedTheme, systemTheme, themeAppearance, themeSelection }) {
			yield* openThemeControl();
			yield* chooseTheme(choice);
			expect(savedTheme()).toBe(choice);
			yield* closeThemeControl();
			yield* systemTheme(choice === "light");

			yield* openThemeControl();

			yield* outcomes([
				["selection", () => Effect.sync(themeSelection), choice],
				["appearance", () => Effect.sync(themeAppearance), choice],
			]);
		},
	);
}

screens.it(
	"choosing system again after a light choice follows a dark system",
	[],
	function* ({ chooseTheme, openThemeControl, systemTheme, themeAppearance }) {
		yield* openThemeControl();
		yield* chooseTheme("light");
		yield* systemTheme(true);
		expect(themeAppearance()).toBe("light");

		yield* chooseTheme("system");

		expect(themeAppearance()).toBe("dark");
	},
);
