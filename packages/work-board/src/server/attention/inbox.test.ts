import { expect, it } from "vitest";
import { navHtml } from "#server/page/nav.ts";
import { questionId, questionMarkdown, responseMarkdown, revisionOf } from "#server/responses/records.ts";
import { inboxFixture, inboxQuestion, inboxSnapshot } from "#test/inboxFixture.ts";
import { fleetRecords, inboxItems } from "./inbox.ts";
import { inboxHtml } from "./inboxHtml.ts";

it("collects human-owned next actions, open questions, needs-human work and managed Fleet requests once", () => {
	const snapshot = inboxSnapshot();
	expect(inboxItems(snapshot).map((item) => item.id)).toEqual(["task.review", "question.storage", "task.fleet"]);
	const html = inboxHtml(snapshot);
	expect(html.match(/>Waiting on you</gu)).toHaveLength(1);
	expect(html).toContain("Casey: Review the keyboard evidence");
	expect(html).toContain("A question needs your answer");
	expect(html).toContain('href="/_board/respond?item=question.storage&amp;request=answer"');
	expect(html).toContain("Deployment is blocked");
	expect(html.match(/class="inbox-row"/gu)).toHaveLength(3);
	expect(html).toContain("Managed decision: Delivery needs approval");
	expect(html).toContain('data-modified="3000"');
});

it("excludes closed questions, automation labels and missing actions while disclosing ambiguous identities", () => {
	const files: Record<string, string> = { ...inboxFixture(), "question.md": inboxQuestion.replace("status: open", "status: closed") };
	for (const owner of ["claude", "agent-navigation", "Fleet", "bot", "copilot"]) {
		files["owner.md"] = `---\nid: task.review\nowner: ${owner}\nnext_action: Continue\n---\n# Work`;
		expect(inboxItems(inboxSnapshot(files)).some((item) => item.id === "task.review")).toBe(false);
	}
	files["owner.md"] = "---\nid: task.review\nowner: Casey\n---\n# Work";
	expect(inboxItems(inboxSnapshot(files)).some((item) => item.id === "task.review")).toBe(false);
	files["duplicate.md"] = files["fleet.md"] ?? "";
	expect(inboxItems(inboxSnapshot(files)).map((item) => item.id)).toEqual(["task.fleet", "task.fleet"]);
	expect(inboxHtml(inboxSnapshot(files))).toContain("Duplicate item ID: task.fleet");
	const incomplete = inboxSnapshot(files, ["unreadable.md"]);
	expect(inboxItems(incomplete)).toEqual([]);
	expect(inboxHtml(incomplete)).toContain("Count unavailable");
	expect(inboxHtml(incomplete)).not.toContain("0 waiting");
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
	const nav = navHtml(
		fleet.documents.map((entry) => ({ modified: 0, path: entry.file })),
		"",
		undefined,
		fleet,
	);
	expect(nav).toContain('<details data-key="fleet-records"><summary>Fleet records (3)</summary>');
	for (const file of ["responses/decision.md", "responses/fleet-question.md", "responses/fleet-answer.md"]) {
		expect(nav.slice(nav.indexOf('<details data-key="fleet-records"'))).toContain(`href="/${file}"`);
		expect(nav.slice(0, nav.indexOf('<details data-key="fleet-records"'))).not.toContain(`href="/${file}"`);
	}
	expect(nav.slice(0, nav.indexOf('<details data-key="fleet-records"'))).toContain('href="/responses/question.md"');
	expect(
		navHtml(
			fleet.documents.map((entry) => ({ modified: 0, path: entry.file })),
			"responses/fleet-question.md",
			undefined,
			fleet,
		),
	).toContain('<details data-key="fleet-records" open>');
	expect([...fleetRecords(fleet.model)]).toEqual(["responses/decision.md", "responses/fleet-question.md", "responses/fleet-answer.md"]);
});
