import { metadataModel } from "#server/metadata/model.ts";
import { metadataParse } from "#server/metadata/parse.ts";
import type { Snapshot } from "#server/search/snapshot.ts";

export const inboxQuestion = `---
id: question.storage
kind: question
scope: task
urgency: whenever
status: ready
options:
  - label: Keep local files
    description: Read and write Markdown in the project folder.
  - label: Use a database
    description: Store the project documents in a shared database.
recommended: Keep local files
---
# Where should the project documents live?

Choose where the project keeps its readable source.
`;

export function inboxFixture(): Readonly<Record<string, string>> {
	return {
		"automation.md": "---\nid: task.agent\nkind: task\nowner: codex\nnext_action: Run the tests\n---\n# Automated work\n",
		"closed.md": "---\nid: task.closed\nowner: marvin\nstatus: done\nnext_action: Review\n---\n# Completed work\n",
		"fleet.md":
			"---\nid: task.fleet\nkind: task\nowner: claude\nstatus: ready\nnext_action: Confirm the deployment target\n---\n# Deployment is blocked\n",
		"owner.md":
			"---\nid: task.review\nkind: task\nowner: marvin\nstatus: draft\nnext_action: Review the keyboard evidence\n---\n# Review keyboard behavior\n",
		"question.md": inboxQuestion,
		"responses/decision.md": `---
id: decision.delivery
kind: question
scope: task
urgency: whenever
attention:
  - id: delivery
    kind: decision
    managed: true
    state: open
    reason: Delivery needs approval
    response_from: [maintainer]
    unblocks: [task.fleet]
---
# Fleet delivery decision
`,
	};
}

export function inboxSnapshot(files: Readonly<Record<string, string>> = inboxFixture(), unavailable: readonly string[] = []): Snapshot {
	const documents = Object.entries(files).map(([file, source], index) => ({ file, modified: index * 1000, parsed: metadataParse(source) }));
	return {
		documents,
		entries: documents.map((entry) => ({
			file: entry.file,
			href: `/${entry.file}`,
			kind: "document",
			text: "",
			title:
				entry.parsed.body
					.split("\n")
					.find((line) => line.startsWith("# "))
					?.slice(2) ?? entry.file,
		})),
		model: metadataModel(documents, unavailable),
		modified: new Map(documents.map((entry) => [entry.file, entry.modified])),
		revision: 1,
		unavailable,
	};
}
