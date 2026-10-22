import { expect } from "vitest";
import { board } from "@shivaedev/work-board/server/integration/board.ts";
import { approvedWork, host } from "#test/hostStory.ts";

host.it("consuming an answer settles the ask and the close command repairs previously consumed asks", [approvedWork(["one"])], function* (fleet) {
	const started = yield* fleet.dispatch("one");
	fleet.finishTurn(started, "FLEET_QUESTION: Which storage should I use?");
	const waiting = yield* fleet.reconcile("one");
	const published = waiting.decision?.published;
	if (published === undefined) {
		throw new Error("Expected a published question");
	}
	const original = fleet.readBoard(published.sourcePath);
	yield* fleet.answer("one", "Use PostgreSQL.");
	expect(board.metadataParse(fleet.readBoard(published.sourcePath)).fields).toMatchObject({
		attention: [{ state: "closed" }],
		status: "done",
	});
	fleet.writeBoard(published.sourcePath, original);
	const preview = yield* fleet.cli(["close-finished-decisions", "--dry-run"]);
	expect(preview).toMatchObject({ code: 0 });
	expect(preview.stdout).toContain("1 decision(s) would close.");
	expect(fleet.readBoard(published.sourcePath)).toBe(original);
	const closed = yield* fleet.cli(["close-finished-decisions"]);
	expect(closed).toMatchObject({ code: 0 });
	expect(closed.stdout).toContain("1 decision(s) closed.");
	expect(board.metadataParse(fleet.readBoard(published.sourcePath)).fields).toMatchObject({
		attention: [{ state: "closed" }],
		status: "done",
	});
	expect((yield* fleet.get("one")).step).toBe("working");
	expect(yield* fleet.cli(["close-finished-decisions"])).toMatchObject({ code: 0, stdout: "0 decision(s) closed." });
});

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
