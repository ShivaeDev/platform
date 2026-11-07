import { storyKit } from "@shivaedev/test-story/server/storyKit.ts";
import type { State } from "#test/queryState.ts";
import { queryVerbs } from "#test/queryVerbs.ts";
import { heldReads } from "#test/queryView.ts";
import { screenKit } from "#test/screenKit.ts";

export const queryStories = storyKit(screenKit("query screen", (): State => ({ payload: "first", reads: heldReads() }), queryVerbs));
