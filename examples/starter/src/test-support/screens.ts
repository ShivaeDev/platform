import { storyKit } from "@shivaedev/test-story/server/storyKit.ts";
import type { ScreenSurface } from "#test-support/screenState.ts";
import { themeScreenVerbs } from "./themeScreenVerbs.tsx";
import { uiScreenVerbs } from "./uiScreenVerbs.ts";

export const screens = storyKit({
	clock: "live",
	create: (): ScreenSurface => ({ view: undefined }),
	name: "app controls",
	stages: ["screen"],
	verbs: (engine, story) => ({ ...themeScreenVerbs(engine, story.tell), ...uiScreenVerbs(engine, story.tell) }),
});
