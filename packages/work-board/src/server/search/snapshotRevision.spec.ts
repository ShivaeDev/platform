import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { aFileAddedDuringListing, indexedFiles, indexStory } from "#test/indexStory.ts";

indexStory.it(
	"a file added during the first listing makes that read current at the advanced revision, and the next read reuses it",
	[indexedFiles({ "first.md": "---\nid: first\n---\n# First" }), aFileAddedDuringListing()],
	function* ({ indexedIds, laterReadReuses, readerReadsIndex, revisionOfRead }) {
		yield* readerReadsIndex();

		yield* outcomes({
			"indexed identities": [indexedIds(), ["added", "first"]],
			"next read": [laterReadReuses(), "the same snapshot"],
			"revision of the read": [revisionOfRead(), "current"],
		});
	},
);
