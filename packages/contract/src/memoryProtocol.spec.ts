import { expect } from "vitest";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { memoryDenied, memoryListening, memoryStory, memoryViewing } from "#test/memoryStory.ts";

memoryStory.it("makeClient reads a decoded note over the in-memory protocol", [], function* ({ get }) {
	expect(yield* get(1)).toBe("decoded note 1 titled One");
});

memoryStory.it("makeClient renames a note over the in-memory protocol and reads the saved title", [], function* ({ get, rename }) {
	expect(yield* get(1)).toBe("decoded note 1 titled One");

	yield* rename(1, "Uno");

	expect(yield* get(1)).toBe("decoded note 1 titled Uno");
});

memoryStory.it(
	"an in-memory live subscription receives a changed hint after its initial resync",
	[memoryListening(1)],
	function* ({ hints, nextHint, rename }) {
		expect(yield* hints(1)).toEqual(["resync"]);

		yield* rename(1, "Uno");
		yield* nextHint(1);

		expect(yield* hints(1)).toEqual(["resync", "changed notes 1"]);
	},
);

memoryStory.it("two clients sharing the in-memory protocol receive their own concurrent answers", [], function* ({ parallelReads }) {
	expect(yield* parallelReads()).toEqual(["One", "Two"]);
});

memoryStory.it("an in-memory query receives its decoded declared rejection", [], function* ({ get }) {
	expect(yield* get(9)).toBe("failed with note 9 is missing");
});

memoryStory.it("an in-memory command receives its decoded declared rejection", [], function* ({ rename }) {
	expect(yield* rename(1, "")).toBe("failed with invalid title: Enter a title");
});

memoryStory.it("an in-memory query passes through the server's denying middleware", [memoryDenied], function* ({ get }) {
	expect(yield* get(1)).toBe("failed with denied");
});

memoryStory.it(
	"closing one in-memory subscription releases its server stream and leaves the other receiving hints",
	[memoryListening(1), memoryListening(2)],
	function* ({ close, hints, nextHint, openSubscriptions, rename }) {
		expect(yield* openSubscriptions()).toBe("2 streams open");

		yield* close(1);
		expect(yield* openSubscriptions()).toBe("one stream open");

		yield* rename(2, "Deux");
		yield* nextHint(2);

		yield* outcomes([
			["remaining server streams", () => openSubscriptions(), "one stream open"],
			["remaining subscriber's hints", () => hints(2), ["resync", "changed notes 2"]],
		]);
	},
);

memoryStory.it("an in-memory changed hint refreshes makeClient's mounted query", [memoryViewing], function* ({ refreshed, rename, shownTitle }) {
	expect(yield* shownTitle()).toBe("One");

	yield* rename(1, "Uno");
	yield* refreshed();

	expect(yield* shownTitle()).toBe("Uno");
});
