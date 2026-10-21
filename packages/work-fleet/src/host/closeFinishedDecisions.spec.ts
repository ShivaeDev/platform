import { expect } from "vitest";
import { board } from "@shivaedev/work-board/server/integration/board.ts";
import { finishedDecisionFiles, finishedDecisionWork } from "#test/finishedDecisions.ts";
import { task } from "#test/fleetHost.ts";
import { boardWork, host } from "#test/hostStory.ts";

host.it("the CLI closes an unanswered decision for dropped work", [boardWork({ "one.md": task("one") })], function* (fleet) {
	const decision = yield* fleet.publishBoardDecision("one", {
		id: "one.1",
		links: [],
		reason: "Choose how to continue",
		recommendation: "Review the work",
	});
	fleet.writeBoard("one.md", task("one").replace("kind: task", "kind: task\nstatus: dropped"));
	const closed = yield* fleet.cli(["close-finished-decisions"]);
	expect(closed).toMatchObject({ code: 0 });
	expect(fleet.readBoard(decision.sourcePath)).toContain("Closed because Board work one is dropped.");
	expect(board.metadataParse(fleet.readBoard(decision.sourcePath)).fields.attention).toMatchObject([{ state: "closed" }]);
});

host.it(
	"the CLI previews and closes only unanswered finished decisions, and a second sweep closes none",
	[boardWork({ ...finishedDecisionFiles, "answered.md": task("answered") })],
	function* (fleet) {
		const answered = yield* fleet.publishBoardDecision("answered", {
			id: "answered.1",
			links: [],
			reason: "Choose how to continue",
			recommendation: "Review the work",
		});
		const publications = [...finishedDecisionWork, answered];
		const http = yield* fleet.boardHttp();
		yield* fleet.publishAnswer(http, {
			answers: [{ prompt: "fleet-action", selected: ["retry"], text: "" }],
			author: "orchestrator",
			body: "Continue with the accepted approach.",
			id: "response.answered",
			question: answered.questionId,
			type: "answer",
		});
		fleet.writeBoard("answered.md", task("answered").replace("kind: task", "kind: task\nstatus: done"));
		const original = publications.map(({ sourcePath }) => fleet.readBoard(sourcePath));
		const preview = yield* fleet.cli(["close-finished-decisions", "--dry-run"]);
		expect(preview, preview.stderr).toMatchObject({ code: 0 });
		expect(preview.stdout).toContain("6 decision(s) would close.");
		for (const [index, publication] of publications.entries()) {
			expect(fleet.readBoard(publication.sourcePath)).toBe(original[index]);
		}
		const closed = yield* fleet.cli(["close-finished-decisions"]);
		expect(closed, closed.stderr).toMatchObject({ code: 0 });
		expect(closed.stdout).toContain("6 decision(s) closed.");
		for (const [index, publication] of publications.entries()) {
			const item = finishedDecisionWork[index];
			const finished = item !== undefined && ["done", "deferred", "dropped"].includes(item.status);
			const source = fleet.readBoard(publication.sourcePath);
			expect(board.metadataParse(source).fields.attention).toMatchObject([{ state: finished ? "closed" : "open" }]);
			if (finished) {
				expect(preview.stdout).toContain(`Would close ${publication.sourcePath}: Closed because Board work ${item?.id} is ${item?.status}.`);
				expect(source).toContain(`Closed because Board work ${item?.id} is ${item?.status}.`);
			} else {
				expect(source).toBe(original[index]);
			}
		}
		const again = yield* fleet.cli(["close-finished-decisions"]);
		expect(again).toMatchObject({ code: 0, stdout: "0 decision(s) closed." });
	},
);
