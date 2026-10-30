import { expect } from "vitest";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { automaticLive, resumeStory, watching } from "#test/resumeStory.ts";

for (const trigger of [
	"the browser fires visibilitychange while visible",
	"the browser fires online while visible",
	"the native application resumes",
] as const) {
	resumeStory.it(
		`when ${trigger}, the resume signal re-reads note 1 changed while away`,
		[watching(1)],
		function* ({ changeQuietly, resume, shown, untilReRead }) {
			yield* changeQuietly(1, "Changed while away");
			expect(yield* shown(1)).toBe("One");

			resume(trigger);
			yield* untilReRead(1);

			expect(yield* shown(1)).toBe("Changed while away");
		},
	);
}

for (const event of ["the browser fires visibilitychange while hidden", "the browser fires online while hidden"] as const) {
	resumeStory.it(`when ${event}, the resume signal re-reads nothing`, [watching(1)], function* ({ fireHidden, timesRead }) {
		fireHidden(event);

		expect(yield* timesRead(1)).toBe("read once");
	});
}

resumeStory.it(
	"disposing the registry removes the resume signal's two browser listeners and its native listener",
	[watching(1)],
	function* ({ dispose, listeners }) {
		expect(yield* listeners()).toEqual({ browser: 2, native: 1 });

		dispose();

		expect(yield* listeners()).toEqual({ browser: 0, native: 0 });
	},
);

resumeStory.it(
	"with automatic live reads, a native resume re-reads notes 1 and 2 changed while away and opens no new streams",
	[automaticLive("native"), watching(1, 2)],
	function* ({ changeQuietly, resume, shown, streamsOpened, untilReRead }) {
		yield* changeQuietly(1, "Changed while away");
		yield* changeQuietly(2, "Also changed while away");
		expect(yield* streamsOpened()).toBe("2 streams opened");

		resume("the native application resumes");
		yield* untilReRead(1);
		yield* untilReRead(2);

		yield* outcomes({
			"note 1": [shown(1), "Changed while away"],
			"note 2": [shown(2), "Also changed while away"],
			"streams opened": [streamsOpened(), "2 streams opened"],
		});
	},
);

for (const event of ["visibilitychange", "online"] as const) {
	resumeStory.it(
		`with automatic live reads and no resume source, the global window's ${event} re-reads note 1 changed while away`,
		[automaticLive("browser"), watching(1)],
		function* ({ changeQuietly, globalWindowFires, shown, untilReRead }) {
			yield* changeQuietly(1, "Changed while away");
			expect(yield* shown(1)).toBe("One");

			globalWindowFires(event);
			yield* untilReRead(1);

			expect(yield* shown(1)).toBe("Changed while away");
		},
	);
}

resumeStory.it(
	"after its streams drop, automatic live reconnects them and re-reads note 1 changed while disconnected",
	[automaticLive("native"), watching(1)],
	function* ({ changeQuietly, openStreams, shown, streamsDrop, untilReRead }) {
		yield* streamsDrop();
		yield* changeQuietly(1, "Changed while disconnected");
		expect(yield* openStreams()).toBe("no streams open");

		yield* untilReRead(1);

		yield* outcomes({
			"note 1": [shown(1), "Changed while disconnected"],
			"open streams": [openStreams(), "one stream open"],
		});
	},
);

resumeStory.it(
	"disposing the registry removes automatic live's native resume listener and closes its stream",
	[automaticLive("native"), watching(1)],
	function* ({ dispose, listeners, openStreams }) {
		yield* outcomes({
			listeners: [listeners(), { browser: 0, native: 1 }],
			"open streams": [openStreams(), "one stream open"],
		});

		dispose();

		yield* outcomes({
			listeners: [listeners(), { browser: 0, native: 0 }],
			"open streams": [openStreams(), "no streams open"],
		});
	},
);
