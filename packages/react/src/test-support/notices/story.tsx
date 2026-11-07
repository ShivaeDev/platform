import { storyKit } from "@shivaedev/test-story/server/storyKit.ts";
import { noticeClient } from "#test/notices/client.ts";
import { noticeClockVerbs } from "#test/notices/clock.ts";
import { noticeReadouts } from "#test/notices/readouts.ts";
import type { State } from "#test/notices/state.ts";
import { noticeVerbs } from "#test/notices/verbs.tsx";
import { screenKit } from "#test/screenKit.ts";

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
