import { responseMarkdown } from "@shivaedev/work-board/server/responses/records.ts";
import type { BoardDecision } from "#board/schema.ts";
import { boardHttpFiles } from "#test/boardHttp.ts";

export function supersedeQuestion(root: string, published: BoardDecision, responseId: string, release: boolean) {
	const files = boardHttpFiles(root);
	if (release) {
		files.write(
			"responses/replacement.md",
			responseMarkdown({
				body: "A later turn replaces this answer.",
				id: "response.replacement",
				response: {
					author: "orchestrator",
					question: published.questionId,
					recordedAt: 2000,
					reviewedRevision: published.revision,
					supersedes: responseId,
					type: "answer",
				},
			}),
		);
	} else {
		files.write(published.sourcePath, "# Decision replaced by a later turn\n");
	}
}
