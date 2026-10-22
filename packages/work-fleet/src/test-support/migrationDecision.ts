import { responses } from "@shivaedev/work-board/server/integration/responses.ts";
import type { BoardDecision } from "#board/schema.ts";

export function migrationDecision(receipt: BoardDecision, source: string, receipted: boolean) {
	const context = source
		.replace('"kind":"question"', '"kind":"decision"')
		.replace('"status":"ready"', '"status":"open"')
		.replace('"scope":"task",', "")
		.replace(',"urgency":"blocking"', "");
	const revision = responses.revisionOf(context);
	const questionId = responses.questionId(receipt.itemId, receipt.request, revision, receipt.sourcePath);
	const decision = { ...receipt, questionId, revision };
	const files: Record<string, string> = {
		[receipt.sourcePath]: context,
		[`responses/${receipt.questionId}.md`]: "# Retired fixture registration\n",
		[`responses/${questionId}.md`]: responses.questionMarkdown(
			{
				context,
				id: questionId,
				question: {
					deadline: 9000,
					item: receipt.itemId,
					reason: "Choose",
					registeredAt: 1000,
					request: receipt.request,
					reviewedRevision: revision,
					source: receipt.sourcePath,
				},
			},
			"blocking",
		),
		"responses/answer.migration.md": responses.responseMarkdown({
			body: "",
			id: "answer.migration",
			response: {
				answers: [{ prompt: "fleet-action", selected: ["release"], text: "" }],
				author: "maintainer",
				question: questionId,
				recordedAt: 2000,
				reviewedRevision: revision,
				type: "answer",
			},
		}),
	};
	if (receipted) {
		files["responses/request-receipt.migration.md"] =
			`---\n${JSON.stringify({ id: "request-receipt.migration", kind: "result", "request_receipt": { disposition: "applied", question: questionId, recordedAt: 3000, response: "answer.migration", reviewedRevision: revision } })}\n---\n# Acknowledged\n`;
	}
	return { decision, files };
}
