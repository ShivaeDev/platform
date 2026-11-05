import { storyKit } from "@shivaedev/test-story/server/storyKit.ts";
import type { State } from "./queryState.ts";
import { queryVerbs } from "./queryVerbs.ts";
import { heldReads } from "./queryView.ts";
import { screenKit } from "./screenKit.ts";

export const queryStories = storyKit(screenKit("query screen", (): State => ({ payload: "first", reads: heldReads() }), queryVerbs));
