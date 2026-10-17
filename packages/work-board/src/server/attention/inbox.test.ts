import { expect, it } from "vitest";
import { libraryData } from "#server/navigation/libraryData.ts";
import { questionId, questionMarkdown, responseMarkdown, revisionOf } from "#server/responses/records.ts";
import { inboxFixture, inboxQuestion, inboxSnapshot } from "#test/inboxFixture.ts";
import { fleetRecords, inboxItems } from "./inbox.ts";

it("collects human-owned next actions, open questions, needs-human work and managed Fleet requests once", () => {
	const snapshot = inboxSnapshot();
	expect(inboxItems(snapshot).map((item) => item.id)).toEqual(["task.review", "question.storage", "task.fleet"]);
});

it("excludes closed questions, automation labels and missing actions while disclosing ambiguous identities", () => {
	const files: Record<string, string> = { ...inboxFixture(), "question.md": inboxQuestion.replace("status: open", "status: closed") };
	for (const owner of ["claude", "agent-navigation", "Fleet", "bot", "copilot", "orchestrator", "automation"]) {
		files["owner.md"] = `---\nid: task.review\nowner: ${owner}\nnext_action: Continue\n---\n# Work`;
		expect(inboxItems(inboxSnapshot(files)).some((item) => item.id === "task.review")).toBe(false);
	}
	files["owner.md"] = "---\nid: task.review\nowner: Casey\n---\n# Work";
	expect(inboxItems(inboxSnapshot(files)).some((item) => item.id === "task.review")).toBe(false);
	files["duplicate.md"] = files["fleet.md"] ?? "";
	expect(inboxItems(inboxSnapshot(files)).map((item) => item.id)).toEqual(["task.fleet", "task.fleet"]);
	const incomplete = inboxSnapshot(files, ["unreadable.md"]);
	expect(inboxItems(incomplete)).toEqual([]);
});

it("removes only a uniquely recorded answer to the current question and groups the full Fleet record chain", () => {
	const revision = revisionOf(inboxQuestion);
	const id = questionId("question.storage", "answer", revision, "question.md");
	const captured = {
		context: inboxQuestion,
		id,
		question: {
			deadline: 200,
			item: "question.storage",
			reason: "Answer",
			registeredAt: 100,
			request: "answer",
			reviewedRevision: revision,
			source: "question.md",
		},
	};
	const response = {
		body: "Keep local files",
		id: "response.storage",
		response: { author: "Casey", question: id, recordedAt: 101, reviewedRevision: revision, type: "answer" as const },
	};
	const files: Record<string, string> = {
		...inboxFixture(),
		"responses/answer.md": responseMarkdown(response),
		"responses/question.md": questionMarkdown(captured),
	};
	expect(inboxItems(inboxSnapshot(files)).map((item) => item.id)).not.toContain("question.storage");
	expect(inboxItems(inboxSnapshot({ ...files, "question.md": `${inboxQuestion}\nNew context` })).map((item) => item.id)).toContain(
		"question.storage",
	);
	expect(
		inboxItems(
			inboxSnapshot({ ...files, "responses/answer.md": responseMarkdown({ ...response, response: { ...response.response, type: "clarify" } }) }),
		).map((item) => item.id),
	).toContain("question.storage");
	const decision = files["responses/decision.md"] ?? "";
	const fleetQuestion = {
		...captured,
		context: decision,
		question: {
			...captured.question,
			item: "decision.delivery",
			request: "delivery",
			reviewedRevision: revisionOf(decision),
			source: "responses/decision.md",
		},
	};
	fleetQuestion.id = questionId(fleetQuestion.question.item, "delivery", fleetQuestion.question.reviewedRevision, fleetQuestion.question.source);
	const fleet = inboxSnapshot({
		...files,
		"responses/fleet-answer.md": responseMarkdown({
			...response,
			id: "response.fleet",
			response: { ...response.response, question: fleetQuestion.id, reviewedRevision: fleetQuestion.question.reviewedRevision },
		}),
		"responses/fleet-question.md": questionMarkdown(fleetQuestion),
	});
	const listedFiles = fleet.documents.map((entry) => ({ modified: 0, path: entry.file }));
	const hidden = libraryData(listedFiles, fleet, {});
	const shown = libraryData(listedFiles, fleet, { showFleet: true });
	expect(hidden.fleetCount).toBe(3);
	for (const file of ["responses/decision.md", "responses/fleet-question.md", "responses/fleet-answer.md"]) {
		expect(hidden.files.some((entry) => entry.path === file)).toBe(false);
		expect(shown.files.some((entry) => entry.path === file)).toBe(true);
	}
	expect(hidden.files.some((entry) => entry.path === "responses/question.md")).toBe(true);
	expect([...fleetRecords(fleet.model)]).toEqual(["responses/decision.md", "responses/fleet-question.md", "responses/fleet-answer.md"]);
});

it("links authored questions and managed requests directly to their source item's answer card", () => {
	const items = inboxItems(inboxSnapshot());
	expect(items.find((item) => item.id === "question.storage")?.href).toBe("/_board/item/question.storage/#answer-card-answer");
	expect(items.find((item) => item.id === "task.fleet")?.href).toBe("/_board/item/decision.delivery/#answer-card-delivery");
});
