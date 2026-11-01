import { expect } from "vitest";
import { themeStyles } from "#test-support/themeStyles.ts";

for (const theme of ["light", "dark"] as const) {
	themeStyles.it(`every ${theme} text pair meets WCAG AA's 4.5:1 contrast`, [], function* ({ textContrastFailures }) {
		const failures = yield* textContrastFailures(theme);

		expect(failures).toEqual([]);
	});

	themeStyles.it(`every ${theme} focus ring meets WCAG AA's 3:1 contrast`, [], function* ({ focusRingContrastFailures }) {
		const failures = yield* focusRingContrastFailures(theme);

		expect(failures).toEqual([]);
	});
}

themeStyles.it("a muted foreground that fails contrast reports the nearest lightness that passes", [], function* ({ contrastFailures, setToken }) {
	yield* setToken("muted-foreground", "#aaaaaa", "#aaaaaa");

	const failures = yield* contrastFailures("light", [["muted-foreground", "background"]], 4.5);

	expect(failures).toEqual([
		"light: muted-foreground on background: 2.32:1 (requires 4.5:1); nearest passing HSL lightness for muted-foreground: 46.27% (#767676), preserving hue and saturation (0.01% search steps)",
	]);
});

const nearestColors = [
	["#767676", "passes, being the suggested lightness", []],
	["#777777", "fails, being one step lighter than the suggestion", [expect.stringContaining("light: muted-foreground on background: 4.48:1")]],
] as const;

for (const [color, verdict, failures] of nearestColors) {
	themeStyles.it(`a muted foreground of ${color} ${verdict}`, [], function* ({ contrastFailures, setToken }) {
		yield* setToken("muted-foreground", color, "#aaaaaa");

		const found = yield* contrastFailures("light", [["muted-foreground", "background"]], 4.5);

		expect(found).toEqual(failures);
	});
}

themeStyles.it(
	"a code-added correction also passes on the tinted surface that uses the token",
	[],
	function* ({ contrastFailures, setToken, suggestedColor }) {
		const surface = "code-added/0.1 over muted/0.3";
		yield* setToken("code-added", "#aaaaaa", "#aaaaaa");
		const suggested = yield* suggestedColor("light", "code-added", surface, 4.5);

		yield* setToken("code-added", suggested, "#aaaaaa");

		expect(yield* contrastFailures("light", [["code-added", surface]], 4.5)).toEqual([]);
	},
);
