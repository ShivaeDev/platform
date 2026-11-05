import { storyKit } from "@shivaedev/test-story/server/storyKit.ts";
import { screenKit } from "#test/screenKit.ts";
import { noticeClient } from "./client.ts";
import { noticeClockVerbs } from "./clock.ts";
import { noticeReadouts } from "./readouts.ts";
import type { State } from "./state.ts";
import { noticeVerbs } from "./verbs.tsx";

export const noticesStory = storyKit({
	...screenKit(
		"notice host",
		(): State => ({
			current: { client: noticeClient(), editor: false, host: true, queryFailure: false, screens: true, session: "alice", uninterruptible: false },
			typed: "blocked",
		}),
		(state, screen) => ({
			...noticeVerbs(state, screen),
			...noticeReadouts(state),
			...noticeClockVerbs(state, screen),
		}),
	),
	clock: "test",
});
