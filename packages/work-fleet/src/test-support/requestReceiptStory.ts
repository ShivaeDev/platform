import { metadataModel } from "@shivaedev/work-board/metadata/model.ts";
import { metadataParse } from "@shivaedev/work-board/metadata/parse.ts";
import { questionId, questionMarkdown, responseMarkdown, revisionOf } from "@shivaedev/work-board/responses/records.ts";

type Trait =
	| "managed"
	| "authored"
	| "task"
	| "clarify"
	| "not_now"
	| "duplicate-request"
	| "malformed-source"
	| "duplicate-question"
	| "duplicate-response"
	| "duplicate-receipt"
	| "competing-receipt"
	| "competing-answer";

export function requestReceiptStory(trait: Trait) {
	const attention = {
		id: "action",
		kind: "decision",
		managed: trait !== "authored",
		reason: "Choose next action",
		"response_from": ["maintainer"],
		state: "open",
		unblocks: ["task.one"],
	};
	const requests = trait === "duplicate-request" ? [attention, attention] : [attention];
	const metadata = {
		attention: requests,
		id: "decision.one",
		kind: trait === "task" ? "task" : "decision",
		...(trait === "malformed-source" ? { unsupported: true } : {}),
	};
	const source = `---\n${JSON.stringify(metadata)}\n---\n# Decision\n`;
	const revision = revisionOf(source);
	const question = questionId(metadata.id, attention.id, revision, "decision.md");
	const document = { file: "decision.md", parsed: metadataParse(source) };
	const registered = {
		file: "responses/question.md",
		parsed: metadataParse(
			questionMarkdown({
				context: source,
				id: question,
				question: {
					deadline: 2000,
					item: metadata.id,
					reason: attention.reason,
					registeredAt: 1000,
					request: attention.id,
					reviewedRevision: revision,
					source: document.file,
				},
			}),
		),
	};
	const answer = {
		body: "Retry",
		id: "response.one",
		response: {
			author: "maintainer",
			question,
			recordedAt: 1500,
			reviewedRevision: revision,
			type: trait === "clarify" || trait === "not_now" ? trait : ("answer" as const),
		},
	};
	const response = { file: "responses/response.md", parsed: metadataParse(responseMarkdown(answer)) };
	const receipt = {
		file: "responses/receipt.md",
		parsed: metadataParse(
			`---\n${JSON.stringify({ id: "receipt.one", kind: "result", "request_receipt": { disposition: "applied", question, recordedAt: 1800, response: answer.id, reviewedRevision: revision } })}\n---\nReceipt\n`,
		),
	};
	const documents = [document, registered, response, receipt];
	if (trait === "duplicate-question") {
		documents.push({ ...registered, file: "responses/duplicate-question.md" });
	}
	if (trait === "duplicate-response") {
		documents.push({ ...response, file: "responses/duplicate-response.md" });
	}
	if (trait === "duplicate-receipt") {
		documents.push({ ...receipt, file: "responses/duplicate-receipt.md" });
	}
	if (trait === "competing-receipt") {
		documents.push({
			file: "responses/competing-receipt.md",
			parsed: metadataParse((receipt.parsed.raw ?? "").replace("receipt.one", "receipt.two") + receipt.parsed.body),
		});
	}
	if (trait === "competing-answer") {
		documents.push({ file: "responses/competing-answer.md", parsed: metadataParse(responseMarkdown({ ...answer, id: "response.two" })) });
	}
	const request = metadataParse(source).fields.attention?.[0];
	if (!request) {
		throw new Error("The synthetic request fixture did not parse.");
	}
	return { document, model: metadataModel(documents), request };
}
