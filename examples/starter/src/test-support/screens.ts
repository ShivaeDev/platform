import { DateTime, Effect } from "effect";
import { storyKit } from "@shivaedev/test-story/server/storyKit.ts";
import type { ScreenSurface } from "#test-support/screenState.ts";
import { themeScreenVerbs } from "#test-support/themeScreenVerbs.tsx";
import { uiScreenVerbs } from "#test-support/uiScreenVerbs.ts";

export const screens = storyKit({
	clock: Effect.runSync(DateTime.now),
	create: (): ScreenSurface => ({ view: undefined }),
	name: "app controls",
	stages: ["storage", "screen"],
	verbs: (engine, story) => ({ ...themeScreenVerbs(engine, story.tell), ...uiScreenVerbs(engine, story.tell) }),
});
