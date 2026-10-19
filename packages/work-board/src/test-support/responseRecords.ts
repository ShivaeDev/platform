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

const DAY = 86_400_000;

function question(id: string, title: string, status: string) {
	return `---\nid: ${id}\nkind: question\nstatus: ${status}\noptions:\n  - label: Yes\n    description: Go ahead.\n  - label: No\n    description: Leave it.\n---\n# ${title}\n`;
}

function answered(file: string, id: string, title: string, { author = "maintainer", daysAgo, now, status }: AnswerOptions) {
	const source = question(id, title, status);
	const revision = revisionOf(question(id, title, "open"));
	const record = questionId(id, "answer", revision, file);
	return {
		[file]: source,
		[`responses/${record}.md`]: questionMarkdown({
			context: question(id, title, "open"),
			id: record,
			question: { deadline: 0, item: id, reason: title, registeredAt: 0, request: "answer", reviewedRevision: revision, source: file },
		}),
		[`responses/response.${id}.md`]: responseMarkdown({
			body: "",
			id: `response.${id}`,
			response: {
				answers: [{ prompt: "answer", selected: ["option-1"], text: "" }],
				author,
				question: record,
				recordedAt: now - daysAgo * DAY,
				reviewedRevision: revision,
				type: "answer",
			},
		}),
	};
}

interface AnswerOptions {
	readonly author?: string;
	readonly daysAgo: number;
	readonly now: number;
	readonly status: "done" | "open";
}

export function recentAnswersFixture(now: number): Record<string, string> {
	return {
		"home.md": "# Release plans\n",
		...answered("questions/waiting.md", "question.waiting", "Keep the release branch?", { daysAgo: 30, now, status: "open" }),
		...answered("questions/closed.md", "question.closed", "Ship the guide this week?", { daysAgo: 2, now, status: "done" }),
		...answered("questions/old.md", "question.old", "Rename the starter?", { daysAgo: 8, now, status: "done" }),
		...answered("questions/theirs.md", "question.theirs", "Split the docs?", { author: "reviewer", daysAgo: 1, now, status: "done" }),
		...answered("questions/theirs-waiting.md", "question.theirs-waiting", "Drop the old flag?", {
			author: "reviewer",
			daysAgo: 3,
			now,
			status: "open",
		}),
	};
}

function decision(id: string, reason: string) {
	return `---\n${JSON.stringify({
		attention: [{ id: "proceed", kind: "decision", reason, "response_from": ["maintainer"], state: "open", unblocks: ["task.ship"] }],
		id,
		kind: "decision",
	})}\n---\n# Decision for task.ship\n\n::::question{id="proceed" select="one"}\n### How should we proceed?\n\n:::option{id="retry"}\nRetry once the blocker is gone.\n:::\n\n:::option{id="release"}\nRelease the work.\n:::\n::::\n`;
}

function answeredDecision(file: string, id: string, reason: string, recordedAt: number) {
	const source = decision(id, reason);
	const revision = revisionOf(source);
	const record = questionId(id, "proceed", revision, file);
	return {
		[file]: source,
		[`responses/${record}.md`]: questionMarkdown({
			context: source,
			id: record,
			question: { deadline: 0, item: id, reason, registeredAt: 0, request: "proceed", reviewedRevision: revision, source: file },
		}),
		[`responses/response.${id}.md`]: responseMarkdown({
			body: "",
			id: `response.${id}`,
			response: {
				answers: [{ prompt: "proceed", selected: ["retry"], text: "" }],
				author: "maintainer",
				question: record,
				recordedAt,
				reviewedRevision: revision,
				type: "answer",
			},
		}),
	};
}

export function sharedHeadingFixture(now: number): Record<string, string> {
	return {
		"home.md": "# Release plans\n",
		"task.md": "---\nid: task.ship\nkind: task\nstatus: blocked\n---\n# Ship the release\n",
		...answeredDecision("decisions/notes.md", "decision.notes", "The release notes are **missing**", now - DAY),
		...answeredDecision("decisions/review.md", "decision.review", "The PR changed after review", now - 2 * DAY),
	};
}
