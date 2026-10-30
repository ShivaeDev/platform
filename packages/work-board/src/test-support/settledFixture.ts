import { questionId, questionMarkdown, responseMarkdown, revisionOf } from "#server/responses/records.ts";

export function questionSource(id: string, status: string, state?: string) {
	return `---\nid: ${id}\nkind: question\nscope: task\nurgency: whenever\nstatus: ${status}\n${state ? `attention: [{id: answer, kind: decision, state: ${state}, response_from: [maintainer], reason: Choose, unblocks: [${id}]}]\n` : ""}---\n# ${id}\n\nWhich option?\n`;
}

export function settledFixture() {
	const source = questionSource("settled", "done", "closed");
	const context = questionSource("settled", "ready", "open");
	const revision = revisionOf(context);
	const question = questionId("settled", "answer", revision, "decisions/settled.md");
	return {
		files: {
			"decisions/settled.md": source,
			"questions/closed.md": questionSource("closed", "ready", "closed"),
			"questions/deferred.md": questionSource("deferred", "deferred"),
			"questions/dropped.md": questionSource("dropped", "dropped"),
			"questions/mixed.md": questionSource("mixed", "done", "open"),
			"questions/open.md": questionSource("open", "ready", "open"),
			[`responses/${question}.md`]: questionMarkdown({
				context,
				id: question,
				question: {
					deadline: 0,
					item: "settled",
					reason: "Choose",
					registeredAt: 1,
					request: "answer",
					reviewedRevision: revision,
					source: "decisions/settled.md",
				},
			}),
			"responses/answer.settled.md": responseMarkdown({
				body: "Keep the reviewed option.\n",
				id: "answer.settled",
				response: { author: "marvin", question, recordedAt: 2, reviewedRevision: revision, type: "answer" },
			}),
		},
		question,
	};
}
