import { readFile } from "node:fs/promises";
import { Effect } from "effect";
import { storyKit } from "@shivaedev/test-story/server/storyKit.ts";
import { colorContrast } from "./colorContrast.ts";
import { contrastGuidance } from "./contrastGuidance.ts";

export const themeStyles = storyKit({
	create: () => Effect.sync(() => ({ css: "" })),
	name: "stylesheet contrast",
	stages: [],
	verbs: (engine, { tell }) => ({
		contrast: (theme: "light" | "dark", foreground: string, background: string) => colorContrast(engine.css, theme, foreground, background),
		guidance: (theme: "light" | "dark", foreground: string, background: string, minimum: number) =>
			contrastGuidance(engine.css, theme, foreground, background, minimum),
		load: () =>
			Effect.promise(async () => {
				tell("load the application's declared theme tokens");
				engine.css = await readFile(new URL("../client/entry.css", import.meta.url), "utf8");
			}),
		setToken: (name: string, light: string, dark: string) =>
			Effect.sync(() => {
				tell(`port the ${name} token to light ${light} and dark ${dark}`);
				engine.css = engine.css.replace(new RegExp(`--${name}:\\s*light-dark\\([^;]+\\);`, "u"), `--${name}: light-dark(${light}, ${dark});`);
			}),
	}),
});
