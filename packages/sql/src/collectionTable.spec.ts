import { expect } from "vitest";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { collectionTable } from "#test/collectionTable.ts";

collectionTable.it(
	"a repository given only its collection writes and reads the collection's table by id and announces the row's bucket",
	[],
	function* ({ announcedKeys, found, save, storedRows }) {
		yield* save("alice", "https://effect.website");

		yield* outcomes([
			["stored rows in the collection's table", () => storedRows(), [{ url: "https://effect.website", userId: "alice" }]],
			["bookmark read by id", () => found("https://effect.website"), { url: "https://effect.website", userId: "alice" }],
			["announced keys", () => announcedKeys(), ['["bucket","bookmarks","userId","alice"]', "bookmarks", "bookmarks:1"]],
		]);
	},
);

collectionTable.it("a repository without a span prefix names its operation spans after its table", [], function* ({ found, repositorySpans, save }) {
	yield* save("alice", "https://effect.website");
	yield* found("https://effect.website");

	expect(yield* repositorySpans()).toEqual(["bookmarks.insert", "bookmarks.findById"]);
});
