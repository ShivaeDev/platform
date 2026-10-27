import { expect } from "vitest";
import { themeStyles } from "#test-support/themeStyles.ts";

for (const theme of ["light", "dark"] as const) {
	themeStyles.it(`${theme} text and focus pairs meet WCAG AA`, [], function* ({ load, guidance }) {
		yield* load();
		const surfaces = ["background", "card", "popover", "muted", "secondary", "accent", "input/0.3"];
		const pairs = [
			["foreground", "background"],
			["card-foreground", "card"],
			["popover-foreground", "popover"],
			["primary-foreground", "primary"],
			["primary-foreground", "primary/0.9"],
			["secondary-foreground", "secondary"],
			["accent-foreground", "accent"],
			["background", "foreground"],
			["foreground/0.6", "muted"],
			["#ffffff", theme === "dark" ? "destructive/0.6" : "destructive"],
			["#ffffff", "destructive/0.9"],
		];
		for (const surface of surfaces) {
			pairs.push(
				["foreground", surface],
				["muted-foreground", surface],
				["destructive", surface],
				["code-added", surface],
				["primary-foreground", `primary/0.9 over ${surface}`],
				["#ffffff", `${theme === "dark" ? "destructive/0.6" : "destructive"} over ${surface}`],
				["#ffffff", `destructive/0.9 over ${surface}`],
			);
		}
		pairs.push(["code-added", "code-added/0.1 over muted/0.3"], ["destructive", "destructive/0.1 over muted/0.3"]);
		for (const [foreground = "", background = ""] of pairs) {
			const result = guidance(theme, foreground, background, 4.5);
			expect(result.ratio, result.message).toBeGreaterThanOrEqual(4.5);
		}
		for (const surface of surfaces) {
			for (const foreground of ["ring", "ring/0.5"]) {
				const result = guidance(theme, foreground, surface, 3);
				expect(result.ratio, result.message).toBeGreaterThanOrEqual(3);
			}
		}
	});
}

themeStyles.it("a ported palette failure suggests a foreground lightness that passes", [], function* ({ load, setToken, guidance, contrast }) {
	yield* load();
	yield* setToken("muted-foreground", "#aaaaaa", "#aaaaaa");
	const result = guidance("light", "muted-foreground", "background", 4.5);
	expect(() => expect(result.ratio, result.message).toBeGreaterThanOrEqual(4.5)).toThrow(
		/light: muted-foreground on background: 2\.32:1 .*nearest passing HSL lightness for muted-foreground: 46\.27% \(#767676\)/u,
	);
	expect(result.suggestion).toBeDefined();
	yield* setToken("muted-foreground", result.suggestion?.color ?? "#aaaaaa", "#aaaaaa");
	expect(contrast("light", "muted-foreground", "background")).toBeGreaterThanOrEqual(4.5);
	yield* setToken("muted-foreground", "#777777", "#aaaaaa");
	expect(contrast("light", "muted-foreground", "background")).toBeLessThan(4.5);
});

themeStyles.it("a lightness correction includes surfaces that use the foreground token", [], function* ({ load, setToken, guidance, contrast }) {
	yield* load();
	yield* setToken("code-added", "#aaaaaa", "#aaaaaa");
	const surface = "code-added/0.1 over muted/0.3";
	const result = guidance("light", "code-added", surface, 4.5);
	expect(result.ratio).toBeLessThan(4.5);
	expect(result.suggestion).toBeDefined();
	yield* setToken("code-added", result.suggestion?.color ?? "#aaaaaa", "#aaaaaa");
	expect(contrast("light", "code-added", surface), result.message).toBeGreaterThanOrEqual(4.5);
});
