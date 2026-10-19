import { expect } from "vitest";
import { board } from "@shivaedev/work-board/server/integration/board.ts";
import { finishedDecisionFiles, finishedDecisionWork } from "#test/finishedDecisions.ts";
import { task } from "#test/fleetHost.ts";
import { boardWork, host } from "#test/hostStory.ts";

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
		expect(preview.stdout).toContain("300 decision(s) would close.");
		for (const [index, publication] of publications.entries()) {
			expect(fleet.readBoard(publication.sourcePath)).toBe(original[index]);
		}
		const closed = yield* fleet.cli(["close-finished-decisions"]);
		expect(closed, closed.stderr).toMatchObject({ code: 0 });
		expect(closed.stdout).toContain("300 decision(s) closed.");
		for (const [index, publication] of publications.entries()) {
			const item = finishedDecisionWork[index];
			const finished = item !== undefined && ["done", "deferred", "superseded"].includes(item.status);
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
