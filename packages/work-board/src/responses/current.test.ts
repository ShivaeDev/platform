import { expect } from "vitest";
import { reply } from "#test/reply.ts";
import { responseFunctionStory } from "#test/responseFunctionStory.ts";

responseFunctionStory.it(
	"selects the newest response per author regardless of input order and orders equal timestamps by identity",
	[],
	({ currentResponses }) => {
		expect(currentResponses([reply("tie", "orchestrator", 2), reply("first", "orchestrator", 1), reply("newest", "orchestrator", 2)])).toEqual([
			reply("tie", "orchestrator", 2),
		]);
	},
);

responseFunctionStory.it("keeps different authors competing until explicitly superseded", [], ({ currentResponses }) => {
	const replies = [reply("first", "orchestrator", 1), reply("second", "maintainer", 2)];
	expect(currentResponses(replies)).toEqual(replies);
	expect(currentResponses([...replies, reply("resolved", "maintainer", 3, "first")])).toEqual([reply("resolved", "maintainer", 3, "first")]);
});

responseFunctionStory.it("does not resurrect an older answer after another author supersedes the newest", [], ({ currentResponses }) => {
	expect(
		currentResponses([reply("first", "orchestrator", 1), reply("second", "orchestrator", 2), reply("resolved", "maintainer", 3, "second")]),
	).toEqual([reply("resolved", "maintainer", 3, "second")]);
});
