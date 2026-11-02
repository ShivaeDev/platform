import { expect } from "@effect/vitest";
import { rerunStory } from "#test/kit.ts";
import { timesOutOnce } from "#test/timesOutOnce.ts";

rerunStory.it(
	"a test that times out and passes on rerun lists both raw attempt durations in milliseconds",
	[timesOutOnce()],
	function* ({ flakyTests, run, testDurations }) {
		yield* run();

		const { attempts } = yield* testDurations("recovers after a timeout");
		expect(yield* flakyTests()).toMatchObject([
			{
				attempts: 2,
				durations: attempts,
				file: "timeout.spec.ts",
				messages: [expect.stringContaining("Test timed out")],
				name: "recovers after a timeout",
			},
		]);
	},
);
