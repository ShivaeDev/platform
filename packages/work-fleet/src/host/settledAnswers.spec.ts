import { Effect } from "effect";
import { expect } from "vitest";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { board } from "@shivaedev/work-board/server/integration/board.ts";
import { boardFolderStory, folderContains } from "#test/boardFolderStory.ts";
import { approvedWork, host } from "#test/hostStory.ts";

host.it("consuming an answer settles the ask while work continues", [approvedWork(["one"])], function* (fleet) {
	const started = yield* fleet.dispatch("one");
	fleet.finishTurn(started, "FLEET_QUESTION: Which storage should I use?");
	const waiting = yield* fleet.reconcile("one");
	const published = waiting.decision?.published;
	if (published === undefined) {
		throw new Error("Expected a published question");
	}

	yield* fleet.answer("one", "Use PostgreSQL.");
	yield* fleet.refreshBoardIndex();

	expect(board.metadataParse(fleet.readBoard(published.sourcePath)).fields).toMatchObject({
		attention: [{ state: "closed" }],
		status: "done",
	});
	expect((yield* fleet.get("one")).step).toBe("working");
	const cliResult = yield* fleet.cli(["close-finished-decisions"]);
	expect(cliResult).toMatchObject({ code: 0, stdout: "0 decision(s) closed." });
});

boardFolderStory.it(
	"closing finished decisions previews and repairs a consumed answer whose ask is still open",
	[folderContains("withDependency")],
	function* ({ acknowledge, answerDecision, closeFinishedDecisions, files, publishDecision, sourceOf }) {
		const published = yield* publishDecision({ id: "task.one.1", links: [], reason: "Choose storage", recommendation: "Use PostgreSQL" });
		const original = yield* sourceOf(published.sourcePath);
		yield* answerDecision(published, "answer.consumed");
		yield* acknowledge(published, "applied", "answer.consumed");
		files.write(published.sourcePath, original);

		const preview = yield* closeFinishedDecisions({ dryRun: true });

		expect(preview).toMatchObject([{ sourcePath: published.sourcePath, workId: "task.one" }]);
		expect(yield* sourceOf(published.sourcePath)).toBe(original);

		const closed = yield* closeFinishedDecisions();

		expect(closed).toEqual(preview);
		yield* outcomes([
			[
				"decision source",
				() => sourceOf(published.sourcePath).pipe(Effect.map((source) => board.metadataParse(source).fields)),
				{ attention: [{ state: "closed" }], status: "done" },
			],
			["closing again", () => closeFinishedDecisions(), []],
		]);
	},
);

host.it("the close command leaves an unconsumed answer to an earlier revision open", [approvedWork(["one"])], function* (fleet) {
	const published = yield* fleet.publishBoardDecision("one", {
		id: "one.1",
		links: [],
		reason: "Choose storage",
		recommendation: "Use PostgreSQL",
	});
	const http = yield* fleet.boardHttp();
	yield* fleet.publishAnswer(http, {
		answers: [{ prompt: "fleet-action", selected: ["retry"], text: "" }],
		author: "maintainer",
		body: "Use PostgreSQL.",
		id: "response.old-answer",
		question: published.questionId,
		type: "answer",
	});
	const changed = `${fleet.readBoard(published.sourcePath)}\nWhich database version?\n`;
	fleet.writeBoard(published.sourcePath, changed);
	fleet.writeBoard("one.md", fleet.readBoard("one.md").replace("kind: task", "kind: task\nstatus: done"));
	expect(yield* fleet.cli(["close-finished-decisions"])).toMatchObject({ code: 0, stdout: "0 decision(s) closed." });
	expect(fleet.readBoard(published.sourcePath)).toBe(changed);
	expect(board.metadataParse(changed).fields).toMatchObject({ attention: [{ state: "open" }], status: "ready", urgency: "blocking" });
});
