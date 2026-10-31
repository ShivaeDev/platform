import { expect } from "vitest";
import { boardHome, boardStory, projectFiles, responsesEnabled } from "#test/boardStory.ts";
import { documentSource } from "#test/documentSource.ts";
import { fleetAcceptsEveryBrief } from "#test/workspaceBoardTraits.ts";

const readingProject = [
	projectFiles({ "checks.md": "# Checks", "nested/reading.md": documentSource, "nested/task.md": "# Task" }),
	boardHome("checks.md"),
	responsesEnabled(),
	fleetAcceptsEveryBrief,
] as const;
const ITEM = "/_board/item/investigation.choices/";
const DUPLICATE = "---\nid: investigation.choices\n---\n# Duplicate";

for (const url of [ITEM, ITEM.slice(0, -1)]) {
	boardStory.it(`the item URL ${url} opens the note that declares the item`, [...readingProject], function* ({ documentRead }) {
		expect(yield* documentRead(url)).toMatchObject({ file: "nested/reading.md", identity: "investigation.choices", metadata: { kind: "task" } });
	});
}

boardStory.it("a reading resolves a sibling note link and an image path to board routes", [...readingProject], function* ({ documentRead }) {
	const { links } = yield* documentRead(ITEM);

	expect(links).toMatchObject({ "../shots/review.png": "/_board/attachment/shots/review.png", "task.md": "/nested/task.md" });
});

boardStory.it(
	"a reading points the item reference and every question action at the item's answer card",
	[...readingProject],
	function* ({ documentRead }) {
		const { questionActions, references } = yield* documentRead(ITEM);

		expect(references["investigation.choices"]).toBe(ITEM);
		expect(questionActions).toMatchObject({
			"/checks": `${ITEM}#answer-card-direction`,
			"direction/display": `${ITEM}#answer-card-direction`,
		});
	},
);

boardStory.it(
	"a reading serves the prose without front matter or question fences and hands the question prompts to the request",
	[...readingProject],
	function* ({ documentRead }) {
		const { requests, source } = yield* documentRead(ITEM);

		expect(source).not.toContain("id: investigation.choices");
		expect(source).not.toContain("::::question");
		expect(requests[0]?.prompts?.[0]?.source).toContain("How should replies appear?");
	},
);

boardStory.it("an answer the reader records shows on the next reading of the note", [...readingProject], function* ({ documentRead, readerAnswers }) {
	expect((yield* documentRead("/nested/reading.md")).requests[0]).toMatchObject({
		id: "direction",
		open: true,
		preview: { context: documentSource },
		responses: [],
	});

	const reviewedRevision = yield* readerAnswers("/nested/reading.md", "Keep the full history.");

	expect((yield* documentRead("/nested/reading.md")).requests[0]?.responses).toEqual([
		expect.objectContaining({ body: expect.stringContaining("Keep the full history."), response: expect.objectContaining({ reviewedRevision }) }),
	]);
});

boardStory.it("the board's root URL opens the configured home note", [...readingProject], function* ({ documentRead }) {
	expect(yield* documentRead("/")).toMatchObject({ file: "checks.md" });
});

boardStory.it("a nested note's page is served over HTTP", [...readingProject], function* ({ getPage }) {
	expect(yield* getPage("/nested/reading.md")).toMatchObject({ status: 200 });
});

boardStory.it(
	"a mounted reading drops the item identity, its references and answer actions once a second note claims the same id",
	[...readingProject],
	function* ({ mountedReadingUpdate, mountsReading, outsideEditorSaves }) {
		expect(yield* mountsReading("/nested/reading.md")).toMatchObject({ identity: "investigation.choices", requests: [{ open: true }] });

		yield* outsideEditorSaves("duplicate.md", DUPLICATE);

		const reading = yield* mountedReadingUpdate();
		expect(reading.identity).toBeUndefined();
		expect(reading.references["investigation.choices"]).toBeUndefined();
		expect(reading.questionActions).toEqual({});
		expect(reading.requests[0]).toMatchObject({ open: false, unavailable: expect.stringContaining("ambiguous") });
		expect(reading.requests[0]?.responses).toBeUndefined();
	},
);

boardStory.it(
	"a malformed response record leaves the request's history unavailable instead of empty",
	[...readingProject],
	function* ({ documentRead, outsideEditorSaves }) {
		expect((yield* documentRead("/nested/reading.md")).requests[0]?.responses).toEqual([]);

		yield* outsideEditorSaves("responses/broken.md", "---\nresponse: {}\n---\n# Damaged record");

		const request = (yield* documentRead("/nested/reading.md")).requests[0];
		expect(request?.unavailable).toContain("malformed");
		expect(request?.responses).toBeUndefined();
	},
);

boardStory.it("reading a note that does not exist fails as not found", [...readingProject], function* ({ documentReadFailure }) {
	expect(yield* documentReadFailure("/missing.md")).toBe("not found");
});

boardStory.it(
	"reading an item whose id two notes claim fails as a conflict",
	[...readingProject],
	function* ({ documentReadFailure, outsideEditorSaves }) {
		expect(yield* documentReadFailure(ITEM)).toBe("read");

		yield* outsideEditorSaves("duplicate.md", DUPLICATE);

		expect(yield* documentReadFailure(ITEM)).toBe("conflict");
	},
);
