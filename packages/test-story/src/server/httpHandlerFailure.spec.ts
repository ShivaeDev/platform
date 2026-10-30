import { expect } from "vitest";
import { storyRunner } from "#test/storyRunner.ts";

for (const [story, thrown] of [
	["handles a reply that throws error", "reply crashed"],
	["handles a reply that throws string", "reply refused"],
	["handles a reply that throws object", '{"_tag":"BrokenReply","reason":"missing fixture"}'],
	["handles a guard that throws", '{"_tag":"BrokenHandler","source":"guard"}'],
	["handles a script that throws", '{"_tag":"BrokenHandler","source":"script"}'],
	["handles a stream that throws", '{"_tag":"BrokenHandler","source":"stream"}'],
] as const) {
	storyRunner.it(
		`fails the story that ${story} with the thrown value even though the application handled the connection error`,
		[],
		function* ({ message, runStory }) {
			yield* runStory("brokenHttpStories", `Broken Fake Story: ${story}`);

			expect(yield* message()).toBe(
				[
					`fake HTTP could not answer GET /data: ${thrown}`,
					"help: Fix the fake's handler. To simulate an HTTP failure, return a reply with an error status.",
				].join("\n"),
			);
		},
	);
}
