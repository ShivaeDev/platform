import { expect } from "vitest";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import {
	liveNotesRenamedWhileAway,
	liveNotesShown,
	liveStreamInterrupted,
	refreshOnResumeShown,
	resumes,
	staleWhileRevalidateShown,
	windowSignalShown,
} from "#test/resumeStories.ts";

const reloading = [
	["the page becomes visible", "pageBecomes"],
	["the browser reconnects", "browserReconnects"],
	["the native app resumes", "nativeResume"],
] as const;

for (const [event, verb] of reloading) {
	resumes.it(`a refresh-on-resume query loads again when ${event}`, [refreshOnResumeShown()], function* (story) {
		expect(yield* story.loads()).toBe("once");

		yield* verb === "pageBecomes" ? story.pageBecomes("visible") : story[verb]();

		expect(yield* story.loads()).toBe("twice");
	});
}

for (const [event, verb] of [
	["the page becomes hidden", "pageBecomes"],
	["the browser reconnects while the page is hidden", "browserReconnects"],
] as const) {
	resumes.it(`a refresh-on-resume query does not load again when ${event}`, [refreshOnResumeShown()], function* (story) {
		yield* story[verb]("hidden");

		expect(yield* story.loads()).toBe("once");
	});
}

resumes.it("closing the screen removes its browser and native resume listeners", [refreshOnResumeShown()], function* ({ close, listeners }) {
	expect(yield* listeners()).toEqual({ browser: 2, native: 1 });

	yield* close();

	expect(yield* listeners()).toEqual({ browser: 0, native: 0 });
});

resumes.it(
	"on native resume, stale-while-revalidate loads the stale query again and keeps the fresh one",
	[staleWhileRevalidateShown()],
	function* ({ nativeResume, staleLoads }) {
		expect(yield* staleLoads()).toEqual({ fresh: 1, stale: 1 });

		yield* nativeResume();

		expect(yield* staleLoads()).toEqual({ fresh: 1, stale: 2 });
	},
);

resumes.it("a resume signal on the real browser window counts a reconnect", [windowSignalShown()], function* ({ shown, windowReconnects }) {
	expect(yield* shown()).toBe("0");

	yield* windowReconnects();

	expect(yield* shown()).toBe("1");
});

for (const source of ["native", "browser"] as const) {
	resumes.it(
		`a ${source} resume shows changes made while away and keeps both live subscriptions`,
		[liveNotesRenamedWhileAway(source)],
		function* ({ liveResume, shown, subscriptions }) {
			expect(yield* shown()).toBe("One / Two");

			yield* liveResume(source);

			yield* outcomes({
				shown: [shown(), "Changed while away / Also changed while away"],
				subscriptions: [subscriptions(), 2],
			});
		},
	);

	resumes.it(
		`a ${source} reconnect after an interrupted stream subscribes again and shows the change it missed`,
		[liveStreamInterrupted(source)],
		function* ({ liveReconnect, openStreams, shown, subscriptions }) {
			expect(yield* openStreams()).toBe("none");

			yield* liveReconnect(source);

			yield* outcomes({
				"open streams": [openStreams(), "two"],
				shown: [shown(), "Changed while disconnected / Two"],
				subscriptions: [subscriptions(), 4],
			});
		},
	);

	resumes.it(`closing a live ${source} screen closes its streams`, [liveNotesShown(source)], function* ({ close, openStreams }) {
		expect(yield* openStreams()).toBe("two");

		yield* close();

		expect(yield* openStreams()).toBe("none");
	});
}

resumes.it("closing a live native screen removes its native resume listener", [liveNotesShown("native")], function* ({ close, listeners }) {
	expect(yield* listeners()).toEqual({ browser: 0, native: 1 });

	yield* close();

	expect(yield* listeners()).toEqual({ browser: 0, native: 0 });
});
