import { Order } from "effect";
import { expect } from "vitest";
import { aFileAddedDuringListing, indexedFiles, indexStory } from "#test/indexStory.ts";

indexStory.it(
	"does not cache an older listing under an advancing revision",
	[indexedFiles({ "first.md": "---\nid: first\n---\n# First" }), aFileAddedDuringListing()],
	function* ({ readIndex, readRevision }) {
		const snapshot = yield* readIndex();
		expect(snapshot.revision).toBe(yield* readRevision());
		expect([...snapshot.model.ids.keys()].sort(Order.String)).toEqual(["added", "first"]);
		expect(yield* readIndex()).toBe(snapshot);
	},
);
