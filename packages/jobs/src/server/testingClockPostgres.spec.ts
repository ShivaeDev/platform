import { expect } from "vitest";
import { outsideClient, testingClock, workerRuntimeOn } from "#test/testingClock.ts";

testingClock.it(
	"a controller on the story's TestClock delivers a job its own runtime enqueued through the one testing client",
	[workerRuntimeOn("the story's TestClock")],
	function* ({ delivered, publish, untilIdle }) {
		yield* publish("work from inside", "the worker's runtime");
		yield* untilIdle();

		expect(yield* delivered()).toBe("work from inside");
	},
);

testingClock.it(
	"a controller on the story's TestClock reports idle and leaves undelivered a job an outside pg-boss client enqueued at real time",
	[workerRuntimeOn("the story's TestClock"), outsideClient],
	function* ({ delivered, publish, untilIdle }) {
		yield* publish("work from outside", "the outside client");
		yield* untilIdle();

		expect(yield* delivered()).toBe("nothing delivered");
	},
);

testingClock.it(
	"a controller on real time waits until its worker delivers a job an outside pg-boss client enqueued",
	[workerRuntimeOn("real time"), outsideClient],
	function* ({ delivered, publish, untilIdle }) {
		yield* publish("work from outside", "the outside client");
		yield* untilIdle();

		expect(yield* delivered()).toBe("work from outside");
	},
);

testingClock.it(
	"a controller refuses a second client when another jobs Layer is built separately with its factory",
	[workerRuntimeOn("real time")],
	function* ({ anotherJobsLayerStarts }) {
		expect(yield* anotherJobsLayerStarts()).toBe("start failed with A testing controller owns one jobs client; create a controller per runtime");
	},
);
