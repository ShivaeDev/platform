import { expect } from "vitest";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { boardStory, projectFiles } from "#test/boardStory.ts";
import { boardOwnedByFiber } from "#test/liveTraits.ts";

const owned = [projectFiles({ "home.md": "# Home" }), boardOwnedByFiber];

boardStory.it(
	"when the fiber that owns the board finishes, its scope closes and the listener refuses connections",
	owned,
	function* ({ listenerState, ownerEnding, ownerFinishes }) {
		expect(yield* listenerState()).toBe("answering");

		ownerFinishes();

		yield* outcomes({
			"the listener": [listenerState(), "refusing connections"],
			"the owner": [ownerEnding(), "finished"],
		});
	},
);

boardStory.it(
	"when the fiber that owns the board is interrupted, the listener refuses connections",
	owned,
	function* ({ listenerState, ownerEnding, ownerInterrupted }) {
		expect(yield* listenerState()).toBe("answering");

		yield* ownerInterrupted();

		yield* outcomes({
			"the listener": [listenerState(), "refusing connections"],
			"the owner": [ownerEnding(), "interrupted"],
		});
	},
);
