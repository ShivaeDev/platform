import { stringify } from "yaml";
import { questionId, questionMarkdown, responseMarkdown, revisionOf } from "#server/responses/records.ts";

export function responseRecords(index: number, item: string, file: string, source: string): Readonly<Record<string, string>> {
	const files: Record<string, string> = {};
	for (const version of ["old", "current"]) {
		const context = version === "old" ? `${source}\nEarlier context.\n` : source;
		const revision = revisionOf(context);
		const id = questionId(item, "choose", revision, file);
		files[`responses/question-${index}-${version}.md`] = questionMarkdown({
			context,
			id,
			question: { deadline: 0, item, reason: "Choose the next step", registeredAt: 1, request: "choose", reviewedRevision: revision, source: file },
		});
		const responseId = `response.fixture.${index}.${version}`;
		files[`responses/answer-${index}-${version}.md`] = responseMarkdown({
			body: "Continue with the recorded direction.",
			id: responseId,
			response: {
				author: "maintainer",
				question: id,
				recordedAt: 2,
				reviewedRevision: revision,
				type: version === "current" && index % 10 === 9 ? "not_now" : "answer",
			},
		});
		if (version === "current") {
			files[`responses/earlier-${index}.md`] = responseMarkdown({
				body: "An earlier answer from the same reader.",
				id: `response.fixture.${index}.earlier`,
				response: { author: "maintainer", question: id, recordedAt: 1, reviewedRevision: revision, type: index % 10 === 9 ? "not_now" : "answer" },
			});
			files[`responses/receipt-${index}.md`] = `---\n${stringify({
				id: `receipt.fixture.${index}`,
				kind: "result",
				"request_receipt": { disposition: "applied", question: id, recordedAt: 3, response: responseId, reviewedRevision: revision },
			})}---\n# Recorded application\n`;
			if (index % 2 === 0) {
				files[`responses/unrelated-${index}.md`] = responseMarkdown({
					body: "Earlier deferral from the same reader.",
					id: `response.fixture.${index}.deferred`,
					response: { author: "maintainer", question: id, recordedAt: 0, reviewedRevision: revision, type: "not_now" },
				});
			}
		}
	}
	return files;
}
