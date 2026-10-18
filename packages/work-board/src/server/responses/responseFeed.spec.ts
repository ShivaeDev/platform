import { expect } from "vitest";
import { boardStory, projectFiles, responsesEnabled } from "#test/boardStory.ts";

const project = projectFiles({
	"first.md":
		"---\nid: task.first\nattention:\n - id: direction\n   kind: decision\n   state: open\n   reason: Which direction?\n   response_from: [maintainer]\n   unblocks: [task.first]\n---\n# First task\n",
	"second.md":
		"---\nid: task.second\nattention:\n - id: review\n   kind: decision\n   state: open\n   reason: Can we proceed?\n   response_from: [maintainer]\n   unblocks: [task.second]\n---\n# Second task\n",
});

boardStory.it(
	"streams two questions' answers in order without replaying earlier responses or repeating records",
	[project, responsesEnabled()],
	function* ({ followResponses, recordFeedResponse, editFile }) {
		yield* recordFeedResponse("task.first", "direction", "response.older", "Old direction.");
		const feed = yield* followResponses();
		yield* recordFeedResponse("task.first", "direction", "response.first", "Keep local files.\nMore context.");
		yield* recordFeedResponse("task.second", "review", "response.second", "Proceed with the review.");
		expect(yield* feed.nextLine()).toBe("task.first\tdirection\tresponse.first\tKeep local files.");
		expect(yield* feed.nextLine()).toBe("task.second\treview\tresponse.second\tProceed with the review.");
		editFile("unrelated.md", "# Unrelated change\n");
		yield* recordFeedResponse("task.first", "direction", "response.clarify", "Which files?", "clarify");
		expect(yield* feed.nextLine()).toBe("task.first\tdirection\tresponse.clarify\tWhich files?");
	},
);

boardStory.it(
	"replays responses from the inclusive since timestamp and continues following new replies",
	[project, responsesEnabled()],
	function* ({ followResponses, recordFeedResponse }) {
		yield* recordFeedResponse("task.first", "direction", "response.before", "Earlier direction.");
		const replay = yield* recordFeedResponse("task.second", "review", "response.replay", "Revisit tomorrow.", "not_now");
		const feed = yield* followResponses(new Date(replay.response.recordedAt).toISOString());
		expect(yield* feed.nextLine()).toBe("task.second\treview\tresponse.replay\tRevisit tomorrow.");
		yield* recordFeedResponse("task.first", "direction", "response.live", "Use the new direction.");
		expect(yield* feed.nextLine()).toBe("task.first\tdirection\tresponse.live\tUse the new direction.");
	},
);
