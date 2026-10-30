import { expect } from "vitest";
import { authStories } from "#test/authStories.ts";

authStories.it(
	"an auth call whose transport rejects fails as auth unavailable with the rejection as its cause",
	[],
	function* ({ dispatch, failure }) {
		yield* dispatch();

		expect(yield* failure()).toBe("auth unavailable: Connection refused");
	},
);
