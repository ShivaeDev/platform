import { expect, it, vi } from "vitest";
import { inboxCount, navigationData } from "#server/navigation/model.ts";
import * as records from "#server/responses/records.ts";
import { inboxSnapshot } from "#test/inboxFixture.ts";
import { responseWorkspace } from "#test/responseWorkspace.ts";
import { responseIndex } from "./responseIndex.ts";

it("validates response records once per model and does not revisit them for repeated document navigation or shell counts", () => {
	const snapshot = inboxSnapshot(responseWorkspace(20));
	const responses = vi.spyOn(records, "responseFrom");
	const questions = vi.spyOn(records, "questionFrom");
	try {
		expect(inboxCount(snapshot)).toBe(2);
		expect(responses).toHaveBeenCalledTimes(snapshot.documents.length);
		expect(questions).toHaveBeenCalledTimes(snapshot.documents.length);
		responses.mockClear();
		questions.mockClear();
		for (const current of ["document-1.md", "document-2.md", "decisions/decision-1.md"]) {
			expect(navigationData([], current, undefined, snapshot).inboxCount).toBe(2);
		}
		expect(responses).not.toHaveBeenCalled();
		expect(questions).not.toHaveBeenCalled();
	} finally {
		responses.mockRestore();
		questions.mockRestore();
	}
});

it("keeps revision groups, duplicate identities, current answers and global corruption distinct", () => {
	const files = responseWorkspace(2);
	const snapshot = inboxSnapshot(files);
	const index = responseIndex(snapshot.model);
	for (const question of index.questions.values()) {
		expect(index.responsesFor(question).responses).toEqual(records.responsesFor(snapshot.documents, question).responses);
	}
	expect(index.questionsFor("decision.fixture.0", "choose")).toHaveLength(2);
	expect(inboxCount(snapshot)).toBe(0);
	const edited = inboxSnapshot({
		...files,
		"responses/answer-0-current.md": files["responses/answer-0-current.md"]?.replace("type: answer", "type: not_now") ?? "",
	});
	expect(responseIndex(edited.model)).not.toBe(index);
	expect(inboxCount(edited)).toBe(1);
	const duplicate = inboxSnapshot({ ...files, "responses/duplicate.md": files["responses/answer-0-current.md"] ?? "" });
	const question = responseIndex(duplicate.model).questions.get("responses/question-0-current.md");
	expect(question).toBeDefined();
	if (question) {
		expect(responseIndex(duplicate.model).responsesFor(question).ambiguous).toBe(true);
	}
	expect(inboxCount(duplicate)).toBe(1);
	const broken = inboxSnapshot({ ...files, "responses/broken.md": "---\nkind: response\n---\n# Broken" });
	expect(responseIndex(broken.model).malformed).toBe(true);
	expect(inboxCount(broken)).toBe(2);
});
