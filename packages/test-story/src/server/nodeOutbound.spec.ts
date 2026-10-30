import { expect } from "vitest";
import { composedNetwork, networkEnabled } from "#test/outboundNetwork.ts";
import { storyRunner } from "#test/storyRunner.ts";

storyRunner.it("fails a Node story for an unrouted provider even when the application handles the fetch error", [], function* ({ run }) {
	const result = yield* run({ include: "src/test-support/unroutedNodeStories.ts" });

	expect(result.moduleErrors).toEqual([]);
	expect(result.stories).toMatchObject([
		{
			errors: [expect.stringContaining("test-story refused an outbound request to api.github.com")],
			name: "Contained Node Story: handles an unrouted provider request",
			state: "failed",
		},
	]);
});

for (const kit of [networkEnabled, composedNetwork]) {
	kit.it("lets an unrouted provider reach the previous dispatcher after opting into network access", [], function* ({ requestProvider }) {
		const response = yield* requestProvider();

		expect(response).toMatchObject({ method: "GET", name: "fake", path: "/user" });
	});
}
