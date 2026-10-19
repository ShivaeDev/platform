import { expect, it } from "vitest";
import type { RecordedResponse } from "#browser/responses/schema.ts";
import { currentResponses } from "./current.ts";

function reply(id: string, author: string, recordedAt: number, supersedes?: string): RecordedResponse {
	return {
		body: id,
		id,
		response: { author, question: "question.example", recordedAt, reviewedRevision: "a".repeat(64), supersedes, type: "answer" },
	};
}

it("selects the newest response per author regardless of input order and orders equal timestamps by identity", () => {
	expect(currentResponses([reply("tie", "orchestrator", 2), reply("first", "orchestrator", 1), reply("newest", "orchestrator", 2)])).toEqual([
		reply("tie", "orchestrator", 2),
	]);
});

it("keeps different authors competing until explicitly superseded", () => {
	const replies = [reply("first", "orchestrator", 1), reply("second", "maintainer", 2)];
	expect(currentResponses(replies)).toEqual([reply("first", "orchestrator", 1), reply("second", "maintainer", 2)]);
	expect(currentResponses([...replies, reply("resolved", "maintainer", 3, "first")])).toEqual([reply("resolved", "maintainer", 3, "first")]);
});

it("does not resurrect an older answer after another author supersedes the newest", () => {
	expect(
		currentResponses([reply("first", "orchestrator", 1), reply("second", "orchestrator", 2), reply("resolved", "maintainer", 3, "second")]),
	).toEqual([reply("resolved", "maintainer", 3, "second")]);
});
