import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { staleWritesStory } from "#test/staleWritesStory.ts";

staleWritesStory.it(
	"bob's rename of the version alice already renamed answers the shared Conflict, and alice's title stays",
	[],
	function* ({ opens, renames, storedNote }) {
		yield* opens("alice");
		yield* opens("bob");

		yield* outcomes([
			["alice's rename", () => renames("alice", "Errands"), "saved at version 1"],
			[
				"bob's rename",
				() => renames("bob", "Chores"),
				"failed with conflict: This was changed or deleted since you loaded it. Refresh and try again.",
			],
			["the stored note", () => storedNote(), "Errands at version 1"],
		]);
	},
);

staleWritesStory.it(
	"bob's remove of the note alice already removed answers the NotFound its operation chose instead of Conflict",
	[],
	function* ({ opens, removes, storedNote }) {
		yield* opens("alice");
		yield* opens("bob");

		yield* outcomes([
			["alice's remove", () => removes("alice"), "removed"],
			["bob's remove", () => removes("bob"), "failed with not found"],
			["the stored note", () => storedNote(), "no note"],
		]);
	},
);
