import { Effect } from "effect";
import { expect } from "vitest";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { boardStory, deferredServing, projectFiles } from "#test/boardStory.ts";
import { recordedReads } from "#test/readTraits.ts";
import { settledFixture } from "#test/settledFixture.ts";

const fixture = settledFixture();
const files = projectFiles(fixture.files);

boardStory.it(
	"concurrent archive passes preserve every settled source and answer and keep open questions active",
	[files, deferredServing],
	function* (board) {
		yield* board.archiveConcurrently();

		for (const [file, source] of Object.entries(fixture.files)) {
			const id = /^id: (?<id>.+)$/mu.exec(source)?.groups?.id;
			const active = ["questions/open.md", "questions/mixed.md", "questions/deferred.md"].includes(file);
			expect(board.fileSource(active ? file : `.board-settled/${id}.md`)).toBe(source);
		}
		expect(yield* board.archive()).toContain("Moved 0 records.");
	},
);

boardStory.it(
	"archives settled sources and all their answers once without moving open or deferred questions",
	[files, deferredServing],
	function* (board) {
		yield* board.archive();

		for (const [file, source] of Object.entries(fixture.files)) {
			if (["questions/open.md", "questions/mixed.md", "questions/deferred.md"].includes(file)) {
				expect(board.fileSource(file)).toBe(source);
			} else {
				expect(board.fileExists(file)).toBe(false);
			}
		}
		expect(yield* board.archive()).toContain("Moved 0 records.");
	},
);

boardStory.it(
	"opens archived questions and their exact answer history through existing item and source links after restart",
	[files, deferredServing],
	function* (board) {
		yield* board.archive();
		yield* board.start({ fleetPort: null });

		const item = yield* board.readItem("settled");
		expect(item).toMatchObject({ file: "decisions/settled.md", identity: "settled", metadata: { status: "done" } });
		expect(item.requests?.flatMap((request) => request.responses ?? [])).toMatchObject([
			{ body: "Keep the reviewed option.\n", id: "answer.settled" },
		]);
		yield* outcomes({
			"answer item link": [Effect.map(board.readItem("answer.settled"), (document) => document.source), "Keep the reviewed option.\n"],
			"original source link": [Effect.map(board.readDocument("decisions/settled.md"), (document) => document.source), item.source],
		});
		for (const [file, source] of Object.entries(fixture.files)) {
			if (!["questions/open.md", "questions/mixed.md", "questions/deferred.md"].includes(file)) {
				const id = /^id: (?<id>.+)$/mu.exec(source)?.groups?.id;
				expect(board.fileSource(`.board-settled/${id}.md`)).toBe(source);
			}
		}
	},
);

boardStory.it(
	"routine reads after startup never read settled Markdown even after an open question changes",
	[files, deferredServing, recordedReads()],
	function* (board) {
		yield* board.archive();
		yield* board.start({ fleetPort: null });
		const events = yield* board.watchProject();
		yield* events.next();
		const before = board.readFiles().length;

		board.editFile("questions/open.md", `${fixture.files["questions/open.md"]}\nMore context.\n`);
		yield* events.changed("questions/open.md");
		yield* board.readToday();

		const reads = board.readFiles().slice(before);
		expect(reads).toContain("questions/open.md");
		expect(reads.filter((file) => file.startsWith(".board-settled/") && file.endsWith(".md"))).toEqual([]);
	},
);

boardStory.it(
	"resumes a partially moved archive group without losing its answer or moving an open question",
	[files, deferredServing],
	function* (board) {
		yield* board.archive();
		board.moveFile(".board-settled/answer.settled.md", "responses/answer.settled.md");

		expect(yield* board.archive()).toContain("Moved 1 records.");

		expect(board.fileSource(".board-settled/answer.settled.md")).toBe(fixture.files["responses/answer.settled.md"]);
		expect(board.fileExists("responses/answer.settled.md")).toBe(false);
		expect(board.fileSource("questions/open.md")).toBe(fixture.files["questions/open.md"]);
	},
);
