import { expect } from "vitest";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { archivedSources } from "#test/attentionLaneTraits.ts";
import { boardStory, deferredServing, projectFiles } from "#test/boardStory.ts";
import { recordedReads } from "#test/readTraits.ts";
import { settledFixture } from "#test/settledFixture.ts";

const { files, question } = settledFixture();
const settledQuestions = projectFiles(files, "the project has settled, open and deferred questions");
const ACTIVE = ["questions/deferred.md", "questions/mixed.md", "questions/open.md"];
const SETTLED = ["decisions/settled.md", "questions/closed.md", "questions/dropped.md", `responses/${question}.md`, "responses/answer.settled.md"];
const STORED = {
	"answer.settled": files["responses/answer.settled.md"],
	closed: files["questions/closed.md"],
	dropped: files["questions/dropped.md"],
	settled: files["decisions/settled.md"],
	[question]: files[`responses/${question}.md`],
};
const MISSING = Object.fromEntries(SETTLED.map((file) => [file, "missing"]));

boardStory.it(
	"archiving moves settled questions, their registered question and their answer into the settled store unchanged",
	[settledQuestions, deferredServing],
	function* ({ archivePass, settledStore, sourcesAt }) {
		expect(yield* settledStore()).toEqual({});

		yield* archivePass();

		yield* outcomes([
			["original places", () => sourcesAt(SETTLED), MISSING],
			["settled store", () => settledStore(), STORED],
		]);
	},
);

boardStory.it(
	"archiving leaves open, mixed and deferred questions where they are",
	[settledQuestions, deferredServing],
	function* ({ archivePass, sourcesAt }) {
		yield* archivePass();

		expect(yield* sourcesAt(ACTIVE)).toEqual(Object.fromEntries(ACTIVE.map((file) => [file, files[file]])));
	},
);

boardStory.it(
	"concurrent archive passes by Board and Fleet store every settled record once and leave open questions active",
	[settledQuestions, deferredServing],
	function* ({ archiveConcurrently, settledStore, sourcesAt }) {
		yield* archiveConcurrently();

		yield* outcomes([
			["active questions", () => sourcesAt(ACTIVE), Object.fromEntries(ACTIVE.map((file) => [file, files[file]]))],
			["settled store", () => settledStore(), STORED],
		]);
	},
);

boardStory.it("a second archive pass moves no records", [archivedSources(files), deferredServing], function* ({ archivePass }) {
	expect(yield* archivePass()).toBe("Moved 0 records.");
});

boardStory.it(
	"an archived question opens at its item link with its recorded answer",
	[archivedSources(files)],
	function* ({ answersOf, briefStatus, foundAt }) {
		yield* outcomes([
			["answers", () => answersOf("settled"), [{ body: "Keep the reviewed option.\n", id: "answer.settled" }]],
			["path", () => foundAt("settled"), "decisions/settled.md"],
			["status", () => briefStatus("settled"), "done"],
		]);
	},
);

boardStory.it("an archived answer opens at its own item link", [archivedSources(files)], function* ({ readItem }) {
	expect((yield* readItem("answer.settled")).source).toBe("Keep the reviewed option.\n");
});

boardStory.it("an archived question opens at its original source link", [archivedSources(files)], function* ({ readDocument }) {
	expect((yield* readDocument("decisions/settled.md")).source).toBe("# settled\n\nWhich option?\n");
});

boardStory.it(
	"after an open question changes, the Board's reads and Today never read settled Markdown",
	[archivedSources(files), recordedReads()],
	function* ({ clearRecordedReads, edited, readToday, recordedReadsUnder }) {
		yield* clearRecordedReads();

		yield* edited("questions/open.md", `${files["questions/open.md"]}\nMore context.\n`);
		yield* readToday();

		yield* outcomes([
			["open question re-read", () => recordedReadsUnder("questions"), expect.arrayContaining(["questions/open.md"])],
			["settled Markdown read", () => recordedReadsUnder(".board-settled"), []],
		]);
	},
);

boardStory.it(
	"the next archive pass finishes a partly moved settled group without moving an open question",
	[archivedSources(files), deferredServing],
	function* ({ archivePass, moveFile, settledStore, sourcesAt }) {
		moveFile(".board-settled/answer.settled.md", "responses/answer.settled.md");

		expect(yield* archivePass()).toBe("Moved 1 records.");

		yield* outcomes([
			["answer's original place", () => sourcesAt(["responses/answer.settled.md"]), { "responses/answer.settled.md": "missing" }],
			["open question", () => sourcesAt(["questions/open.md"]), { "questions/open.md": files["questions/open.md"] }],
			["settled store", () => settledStore(), STORED],
		]);
	},
);
