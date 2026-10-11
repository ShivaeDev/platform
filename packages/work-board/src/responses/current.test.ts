import { expect, it } from "vitest";
import type { RecordedResponse } from "#browser/responses/schema.ts";
import { currentResponses } from "./current.ts";

function response(id: string, author: string, recordedAt: number, supersedes?: string): RecordedResponse {
	return {
		body: id,
		id,
		response: { author, question: "question.example", recordedAt, reviewedRevision: "a".repeat(64), supersedes, type: "answer" },
	};
}

it("selects the newest response per author regardless of input order and orders equal timestamps by identity", () => {
	const oldest = response("first", "orchestrator", 1);
	const newest = response("newest", "orchestrator", 2);
	const tie = response("tie", "orchestrator", 2);
	expect(currentResponses([tie, oldest, newest])).toEqual([tie]);
});

it("keeps different authors competing until explicitly superseded", () => {
	const first = response("first", "orchestrator", 1);
	const second = response("second", "maintainer", 2);
	expect(currentResponses([first, second])).toEqual([first, second]);
	const resolved = response("resolved", "maintainer", 3, first.id);
	expect(currentResponses([first, second, resolved])).toEqual([resolved]);
});

it("does not resurrect an older answer after another author supersedes the newest", () => {
	const first = response("first", "orchestrator", 1);
	const second = response("second", "orchestrator", 2);
	const resolved = response("resolved", "maintainer", 3, second.id);
	expect(currentResponses([first, second, resolved])).toEqual([resolved]);
});
