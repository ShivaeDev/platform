import { expect } from "vitest";
import { screens } from "#test-support/screens.ts";

screens.it(
	"follows system changes until a light or dark choice overrides them",
	[],
	function* ({ openThemeControl, systemTheme, themeAppearance, chooseTheme, themeSelection }) {
		yield* systemTheme(true);
		yield* openThemeControl();
		expect(themeSelection()).toBe("system");
		expect(themeAppearance()).toBe("dark");
		yield* systemTheme(false);
		expect(themeAppearance()).toBe("light");
		yield* chooseTheme("dark");
		expect(themeAppearance()).toBe("dark");
		yield* systemTheme(true);
		yield* systemTheme(false);
		expect(themeAppearance()).toBe("dark");
		yield* chooseTheme("light");
		yield* systemTheme(true);
		expect(themeAppearance()).toBe("light");
		yield* chooseTheme("system");
		expect(themeAppearance()).toBe("dark");
	},
);

screens.it(
	"restores the saved override when the control opens again",
	[],
	function* ({ openThemeControl, closeThemeControl, systemTheme, chooseTheme, themeAppearance, themeSelection, savedTheme }) {
		yield* openThemeControl();
		yield* chooseTheme("dark");
		expect(savedTheme()).toBe("dark");
		yield* closeThemeControl();
		yield* systemTheme(false);
		yield* openThemeControl();
		expect(themeSelection()).toBe("dark");
		expect(themeAppearance()).toBe("dark");
		yield* chooseTheme("light");
		yield* closeThemeControl();
		yield* systemTheme(true);
		yield* openThemeControl();
		expect(themeSelection()).toBe("light");
		expect(themeAppearance()).toBe("light");
	},
);
