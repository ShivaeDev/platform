import { expect } from "vitest";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { duplicateQueue, moduleWorkers, replacedPublisher } from "#test/modules/workerStory.ts";

moduleWorkers.it(
	"the shared module list supplies the default publisher to HTTP and both workers",
	[],
	function* ({ publish, index, complete, published, preview }) {
		yield* outcomes([
			["published titles", () => published(), []],
			["host publisher", () => preview("A draft"), "Published: A draft"],
		]);

		yield* publish("A note");
		yield* index("A task");
		yield* complete();

		expect(yield* published()).toEqual(["Published: A note", "Published: A task"]);
	},
);

moduleWorkers.it(
	"one publisher replacement reaches the host's service and both workers",
	[replacedPublisher],
	function* ({ publish, index, complete, published, preview }) {
		expect(yield* preview("A draft")).toBe("Replacement: A draft");

		yield* publish("A note");
		yield* index("A task");
		yield* complete();

		expect(yield* published()).toEqual(["Replacement: A note", "Replacement: A task"]);
	},
);

for (const kind of ["shared", "separate", "within"] as const) {
	moduleWorkers.it(`composition rejects ${kind} duplicate queues and names their owners`, [duplicateQueue(kind)], function* ({ queueConflict }) {
		expect(yield* queueConflict()).toEqual({
			firstModule: "publishing",
			queue: "notes.publish",
			secondModule: kind === "within" ? "publishing" : "indexing",
		});
	});
}
