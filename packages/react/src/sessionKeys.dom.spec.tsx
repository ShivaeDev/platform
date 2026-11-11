import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { sessionKeys, sessionsSharingOneRuntime } from "#test/shared-runtime/story.tsx";

sessionKeys.it(
	"alice's save re-reads her preferences and not bob's, though both read the same key through one shared runtime",
	[sessionsSharingOneRuntime()],
	function* ({ reads, save, shown }) {
		yield* outcomes([
			["alice's reads before", () => reads("alice"), 1],
			["bob's reads before", () => reads("bob"), 1],
		]);

		yield* save("alice", "Changed");

		yield* outcomes([
			["alice's preferences", () => shown("alice"), "Changed"],
			["alice's reads", () => reads("alice"), 2],
			["bob's preferences", () => shown("bob"), "Bob"],
			["bob's reads", () => reads("bob"), 1],
		]);
	},
);
