import { expect } from "vitest";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { boardStory, projectFiles, responsesEnabled } from "#test/boardStory.ts";

const TWO_TASKS = boardStory.traits(
	projectFiles(
		{
			"first.md":
				"---\nid: task.first\nattention:\n - id: direction\n   kind: decision\n   state: open\n   reason: Which direction?\n   response_from: [maintainer]\n   unblocks: [task.first]\n---\n# First task\n",
			"second.md":
				"---\nid: task.second\nattention:\n - id: review\n   kind: decision\n   state: open\n   reason: Can we proceed?\n   response_from: [maintainer]\n   unblocks: [task.second]\n---\n# Second task\n",
		},
		"task.first asks for direction and task.second asks for a review",
	),
	responsesEnabled(),
);

boardStory.it(
	"the response feed prints new replies to two questions in order, with only each reply's first line, and skips earlier replies",
	[TWO_TASKS],
	function* ({ feedPrints, followResponses, maintainerReplies }) {
		yield* maintainerReplies("task.first", "direction", "response.older", "Old direction.");
		yield* followResponses();

		yield* maintainerReplies("task.first", "direction", "response.first", "Keep local files.\nMore context.");
		yield* maintainerReplies("task.second", "review", "response.second", "Proceed with the review.");

		yield* outcomes([
			["first line", () => feedPrints(), "task.first\tdirection\tresponse.first\tKeep local files."],
			["second line", () => feedPrints(), "task.second\treview\tresponse.second\tProceed with the review."],
		]);
	},
);

boardStory.it(
	"an unrelated edit does not make the response feed print a reply again",
	[TWO_TASKS],
	function* ({ edited, feedPrints, followResponses, maintainerReplies }) {
		yield* followResponses();
		yield* maintainerReplies("task.first", "direction", "response.first", "Keep local files.");
		expect(yield* feedPrints()).toBe("task.first\tdirection\tresponse.first\tKeep local files.");

		yield* edited("unrelated.md", "# Unrelated change\n");
		yield* maintainerReplies("task.first", "direction", "response.clarify", "Which files?", "clarify");

		expect(yield* feedPrints()).toBe("task.first\tdirection\tresponse.clarify\tWhich files?");
	},
);

boardStory.it(
	"a response feed started from a reply's moment replays that reply and then follows new ones",
	[TWO_TASKS],
	function* ({ feedPrints, followResponsesSince, maintainerReplies }) {
		yield* maintainerReplies("task.first", "direction", "response.before", "Earlier direction.");
		yield* maintainerReplies("task.second", "review", "response.replay", "Revisit tomorrow.", "not_now");

		yield* followResponsesSince("response.replay");
		yield* maintainerReplies("task.first", "direction", "response.live", "Use the new direction.");

		yield* outcomes([
			["first line", () => feedPrints(), "task.second\treview\tresponse.replay\tRevisit tomorrow."],
			["second line", () => feedPrints(), "task.first\tdirection\tresponse.live\tUse the new direction."],
		]);
	},
);
