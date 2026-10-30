import { expect } from "vitest";
import { storyRunner } from "#test/storyRunner.ts";

storyRunner.it(
	"fails stories at scope close with thrown fake values even when the application handles the connection error",
	[],
	function* ({ run }) {
		const result = yield* run({ include: "src/test-support/brokenHttpStories.ts" });

		expect(result.moduleErrors).toEqual([]);
		expect(result.stories.map(({ state, errors }) => ({ errors, state }))).toEqual([
			...["reply crashed", "reply refused", '{"_tag":"BrokenReply","reason":"missing fixture"}'].map((description) => ({
				errors: [expect.stringContaining(`fake HTTP could not answer GET /data: ${description}`)],
				state: "failed",
			})),
			...["guard", "script", "stream"].map((source) => ({
				errors: [expect.stringContaining(`fake HTTP could not answer GET /data: {"_tag":"BrokenHandler","source":"${source}"}`)],
				state: "failed",
			})),
		]);
	},
);
