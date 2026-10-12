import { expect, it } from "vitest";
import { metadataParse } from "#server/metadata/parse.ts";
import { questionId, questionMarkdown, revisionOf } from "#server/responses/records.ts";
import { decisionContext, questionPacket, questionPath } from "#test/responsePacket.ts";
import { documentBody } from "./body.ts";

it("reads a registered question's captured prose while retaining the exact context and reviewed revision", () => {
	const parsed = metadataParse(questionPacket);
	expect(documentBody({ file: questionPath, parsed })).toBe(metadataParse(decisionContext).body);
	expect(parsed.body).toBe(decisionContext);
	expect(parsed.fields.question?.reviewedRevision).toBe(revisionOf(parsed.body));
});

it("keeps unregistered and damaged question bodies intact", () => {
	for (const source of [
		`---\nid: question.authored\nkind: question\n---\n${decisionContext}`,
		questionPacket.replace("Read the evidence", "Changed evidence"),
		questionPacket.replace("id: question.", "id: damaged."),
	]) {
		const parsed = metadataParse(source);
		expect(documentBody({ file: questionPath, parsed })).toBe(parsed.body);
	}
});

it("retains ordinary prose, thematic breaks and code examples in a registered question", () => {
	const context = "# Plain question\n\nBefore\n\n---\n\nAfter\n\n```yaml\n---\nattention: []\n---\n```\n";
	const revision = revisionOf(context);
	const source = questionMarkdown({
		context,
		id: questionId("task.fixture", "direction", revision, "task.md"),
		question: {
			deadline: 172_800_000,
			item: "task.fixture",
			reason: "Choose",
			registeredAt: 0,
			request: "direction",
			reviewedRevision: revision,
			source: "task.md",
		},
	});
	expect(documentBody({ file: questionPath, parsed: metadataParse(source) })).toBe(context);
});
