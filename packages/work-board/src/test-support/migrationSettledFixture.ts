import { questionId, questionMarkdown, responseMarkdown, revisionOf } from "#server/responses/records.ts";

function decisionSource(name: string, legacy: boolean) {
	return `---\nid: decision.${name}\nkind: ${legacy ? "decision" : "question"}\nstatus: ${legacy ? "open" : "ready"}\n${legacy ? "" : "scope: task\nurgency: blocking\n"}attention: [{id: choice, kind: decision, managed: true, reason: Choose, response_from: [${name === "agent" ? "orchestrator" : "maintainer"}], state: open, unblocks: [task.${name}]}]\n---\n# Choose the next step\n`;
}

export function migrationSettledFixture(legacy: boolean) {
	const files: Record<string, string> = {};
	for (const name of ["settled", "answered", "agent", "resolved"]) {
		const item = `decision.${name}`;
		const file = `responses/${item}.md`;
		const source = decisionSource(name, legacy);
		const revision = revisionOf(source);
		const id = questionId(item, "choice", revision, file);
		files[file] = source;
		files[`task.${name}.md`] = `---\nid: task.${name}\nkind: task\nstatus: ${name === "resolved" ? "done" : "ready"}\n---\n# ${name}\n`;
		files[`responses/${id}.md`] = questionMarkdown({
			context: source,
			id,
			question: { deadline: 9000, item, reason: "Choose", registeredAt: 1000, request: "choice", reviewedRevision: revision, source: file },
		});
		if (["settled", "answered"].includes(name)) {
			files[`responses/answer.${name}.md`] = responseMarkdown({
				body: "",
				id: `answer.${name}`,
				response: {
					answers: [{ prompt: "choice", selected: ["release"], text: "" }],
					author: "maintainer",
					question: id,
					recordedAt: 2000,
					reviewedRevision: revision,
					type: "answer",
				},
			});
		}
		if (name === "settled") {
			files["responses/request-receipt.settled.md"] =
				`---\n${JSON.stringify({ id: "request-receipt.settled", kind: legacy ? "result" : "report", "request_receipt": { disposition: "applied", question: id, recordedAt: 3000, response: "answer.settled", reviewedRevision: revision } })}\n---\n# Acknowledged\n`;
		}
	}
	return files;
}
