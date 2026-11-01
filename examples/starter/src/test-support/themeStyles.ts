import { readFile } from "node:fs/promises";
import { Effect } from "effect";
import { storyKit } from "@shivaedev/test-story/server/storyKit.ts";
import { contrastGuidance } from "./contrastGuidance.ts";
import { focusPairs, textPairs } from "./themePairs.ts";

function failures(css: string, theme: "light" | "dark", pairs: readonly (readonly [string, string])[], minimum: number) {
	return pairs.flatMap(([foreground, background]) => {
		const result = contrastGuidance(css, theme, foreground, background, minimum);
		return result.ratio >= minimum ? [] : [result.message];
	});
}

export const themeStyles = storyKit({
	create: () => Effect.promise(async () => ({ css: await readFile(new URL("../client/main.css", import.meta.url), "utf8") })),
	name: "stylesheet contrast",
	stages: [],
	verbs: (engine, { tell }) => ({
		contrastFailures: (theme: "light" | "dark", pairs: readonly (readonly [string, string])[], minimum: number) =>
			Effect.sync(() => failures(engine.css, theme, pairs, minimum)),
		focusRingContrastFailures: (theme: "light" | "dark") => Effect.sync(() => failures(engine.css, theme, focusPairs(), 3)),
		setToken: (name: string, light: string, dark: string) =>
			Effect.sync(() => {
				tell(`the ${name} token changes to light ${light} and dark ${dark}`);
				engine.css = engine.css.replace(new RegExp(`--${name}:\\s*light-dark\\([^;]+\\);`, "u"), `--${name}: light-dark(${light}, ${dark});`);
			}),
		suggestedColor: (theme: "light" | "dark", foreground: string, background: string, minimum: number) =>
			Effect.sync(() => contrastGuidance(engine.css, theme, foreground, background, minimum).suggestion?.color ?? "none"),
		textContrastFailures: (theme: "light" | "dark") => Effect.sync(() => failures(engine.css, theme, textPairs(theme), 4.5)),
	}),
});
