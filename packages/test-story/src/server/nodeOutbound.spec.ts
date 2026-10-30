import { expect } from "vitest";
import { composedNetwork, networkEnabled } from "#test/outboundNetwork.ts";
import { storyRunner } from "#test/storyRunner.ts";

storyRunner.it(
	"fails a Node story for an unrouted provider even when the application handles the fetch error",
	[],
	function* ({ message, runStory }) {
		yield* runStory("unroutedNodeStories", "Contained Node Story: handles an unrouted provider request");

		expect(yield* message()).toBe(
			[
				"test-story refused an outbound request to api.github.com",
				"help: Add this hostname to the story kit's outbound map and point it at a fake server. Only loopback requests may run",
				"      without a route.",
			].join("\n"),
		);
	},
);

for (const [kit, how] of [
	[networkEnabled, "after its kit opts into network access"],
	[composedNetwork, "through a kit that extends one that opted into network access"],
] as const) {
	kit.it(`lets an unrouted provider request reach the network ${how}`, [], function* ({ requestsProvider }) {
		const answer = yield* requestsProvider();

		expect(answer).toBe("the fake server answered GET /user");
	});
}
