import { expect } from "vitest";
import { themeStyles } from "#test-support/themeStyles.ts";

for (const theme of ["light", "dark"] as const) {
	themeStyles.it(`${theme} text and focus pairs meet WCAG AA`, [], function* ({ load, contrast }) {
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
			expect(contrast(theme, foreground, background), `${theme}: ${foreground} on ${background}`).toBeGreaterThanOrEqual(4.5);
		}
		for (const surface of surfaces) {
			expect(contrast(theme, "ring", surface), `${theme}: focus on ${surface}`).toBeGreaterThanOrEqual(3);
			expect(contrast(theme, "ring/0.5", surface), `${theme}: stock focus shadow on ${surface}`).toBeGreaterThanOrEqual(3);
		}
	});
}
