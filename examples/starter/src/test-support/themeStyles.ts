import { readFile } from "node:fs/promises";
import { Effect } from "effect";
import { storyKit } from "@shivaedev/test-story/storyKit.ts";
import { colorContrast } from "./colorContrast.ts";

export const themeStyles = storyKit({
	create: () => Effect.sync(() => ({ css: "" })),
	name: "stylesheet contrast",
	stages: [],
	verbs: (engine, { tell }) => ({
		contrast: (theme: "light" | "dark", foreground: string, background: string) => colorContrast(engine.css, theme, foreground, background),
		load: () =>
			Effect.promise(async () => {
				tell("load the application's declared theme tokens");
				engine.css = await readFile(new URL("../client/entry.css", import.meta.url), "utf8");
			}),
	}),
});
