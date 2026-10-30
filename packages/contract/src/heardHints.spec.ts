import { expect } from "vitest";
import { notes } from "#test/viewerEngine.ts";
import { listening, viewerStory } from "#test/viewerStory.ts";

viewerStory.it(
	"heard reports alice's rename of note 1 as heard by its record and her bucket after the hint has arrived",
	[listening("alice", "note 1", "every note of theirs")],
	function* ({ heard, rename, untilHintArrives }) {
		yield* rename("alice", 1, "Changed");
		yield* untilHintArrives("alice");

		expect(yield* heard("alice", [notes.item(1), notes.bucket.userId("alice")])).toBe("heard");
	},
);

viewerStory.it(
	"heard reports note 1 together with note 3 as not heard when only alice's rename of note 1 arrived, once its hour of the story clock passes",
	[listening("alice", "note 1", "note 3")],
	function* ({ heardWithinAnHour, rename, untilHintArrives }) {
		yield* rename("alice", 1, "Changed");
		yield* untilHintArrives("alice");

		expect(yield* heardWithinAnHour("alice", [notes.item(1), notes.item(3)])).toBe("not heard within the hour");
	},
	{ clock: "test" },
);
