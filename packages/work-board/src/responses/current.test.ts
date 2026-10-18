import { expect } from "vitest";
import { responseMarkdown } from "#server/responses/records.ts";
import { boardStory } from "#test/boardStory.ts";
import { reply } from "#test/storyReplies.ts";
import { recordedReplies } from "#test/storyTraits.ts";

boardStory.it(
	"selects the newest response per author regardless of input order and orders equal timestamps by identity",
	[recordedReplies(reply("tie", "orchestrator", 2), reply("first", "orchestrator", 1), reply("newest", "orchestrator", 2))],
	({ reader }) => {
		expect(reader.currentReplies()).toEqual([reply("tie", "orchestrator", 2)]);
	},
);

boardStory.it(
	"keeps different authors competing until explicitly superseded",
	[recordedReplies(reply("first", "orchestrator", 1), reply("second", "maintainer", 2))],
	({ reader, editFile }) => {
		expect(reader.currentReplies()).toEqual([reply("first", "orchestrator", 1), reply("second", "maintainer", 2)]);
		editFile("responses/resolved.md", responseMarkdown(reply("resolved", "maintainer", 3, "first")));
		expect(reader.currentReplies()).toEqual([reply("resolved", "maintainer", 3, "first")]);
	},
);

boardStory.it(
	"does not resurrect an older answer after another author supersedes the newest",
	[recordedReplies(reply("first", "orchestrator", 1), reply("second", "orchestrator", 2), reply("resolved", "maintainer", 3, "second"))],
	({ reader }) => {
		expect(reader.currentReplies()).toEqual([reply("resolved", "maintainer", 3, "second")]);
	},
);
