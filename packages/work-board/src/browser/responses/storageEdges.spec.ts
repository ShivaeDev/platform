import { expect, it } from "vitest";
import { DRAFT_BYTES, encodeDrafts, readDrafts } from "#browser/responses/drafts.ts";
import { edgeDraft } from "#test/coverageEdges.ts";

it("rejects oversized persisted UTF-8 drafts before interpreting their contents", () => {
	const raw = JSON.stringify({ q: { ...edgeDraft, body: "💬".repeat(DRAFT_BYTES / 4) } });
	expect(raw.length).toBeLessThan(DRAFT_BYTES);
	expect(() => readDrafts(raw, 101)).toThrow("Draft storage exceeds the workspace limit.");
});

it("rejects valid JSON that is not a workspace draft map", () => {
	for (const raw of ["null", "[]", '"saved text"', "42", "true"]) {
		expect(() => readDrafts(raw, 101)).toThrow("Draft storage is malformed.");
	}
});

it("restores rich packet drafts with recovery text and explicit supersession", () => {
	const draft = {
		...edgeDraft,
		answers: [{ prompt: "next", selected: [], text: "Review first." }],
		question: "question.edge",
		recovery: "Earlier template text",
		supersedes: "response.earlier",
	};
	expect(readDrafts(encodeDrafts({ q: draft }), 101)).toEqual({ drafts: { q: draft }, expired: false });
});
