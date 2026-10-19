import { createHash } from "node:crypto";

export const REVIEW_TASK =
	"---\r\nid: work.keyboard\r\nkind: task\r\nstatus: in-review\r\ncriteria:\r\n  - id: focus\r\n    text: Escape restores focus\r\n  - id: narrow\r\n    text: Narrow layout stays readable\r\n---\r\n# Keyboard work\r\n";

export function reviewResult(version = "First report") {
	return `---
id: result.keyboard
kind: result
status: finished
relationships:
  - kind: implements
    target: work.keyboard
attention:
  - id: review
    kind: review
    state: open
    response_from: [maintainer]
    reason: Review this exact result and its limitations.
    unblocks: [work.keyboard]
evidence:
  - criterion: work.keyboard#focus
    source: ../evidence/focus.md
    checked_revision: '0123456789012345678901234567890123456789'
    method: Actual keyboard check
    outcome: Focus restored in the recorded check
---
# ${version}

## Limits
Narrow-screen evidence is not recorded. Execution completion is a report, not acceptance.

\`\`\`mermaid
flowchart LR
  Result --> Review --> Revision
\`\`\`

::::question{id="verdict" select="one"}
### What should happen with this report?

:::option{id="revision"}
Request another revision and explain the missing evidence.
:::

:::option{id="accept"}
Accept this exact report version with the stated limitations.
:::
::::
`;
}

export const QUIET_RESULT =
	"---\nid: result.quiet\nkind: result\nstatus: received\nrelationships:\n  - kind: informs\n    target: work.quiet\n---\n# Quiet report\n\nThe report body.\n";
export const CHECKED_RESULT =
	"---\nid: result.checked\nkind: result\nstatus: received\nrelationships:\n  - kind: implements\n    target: work.keyboard\n---\n# Checked report\n";
export const UNCHECKED_TASK = "---\nid: work.keyboard\nkind: task\nstatus: in-review\n---\n# Keyboard work\n";
export const LONE_RESULT = "---\nid: result.alone\nkind: result\nstatus: received\n---\n# Lone report\n";
export const ORPHAN_RESULT =
	"---\nid: result.orphan\nkind: result\nstatus: received\nrelationships:\n  - kind: informs\n    target: work.missing\n---\n# Orphan report\n";
export const QUIET_TASK = "---\nid: work.quiet\nkind: task\nstatus: done\n---\n# Quiet work\n";

function sha256(text: string) {
	return createHash("sha256").update(text).digest("hex");
}

function responseFile(id: string, question: string, revision: string, author: string, type: string, recordedAt: number) {
	return `---\nid: ${id}\nkind: response\nresponse:\n  author: ${author}\n  question: ${question}\n  recordedAt: ${recordedAt}\n  reviewedRevision: ${revision}\n  type: ${type}\n---\nFeedback from ${author}.\n`;
}

export function answeredResult(earlier = false): Record<string, string> {
	const file = "items/result.md";
	const source = earlier ? reviewResult("Earlier report") : reviewResult();
	const revision = sha256(source);
	const question = `question.${sha256(JSON.stringify(["result.keyboard", "review", revision, file]))}`;
	return {
		[file]: reviewResult(),
		"items/task.md": REVIEW_TASK,
		[`responses/${question}.md`]: `---\nid: ${question}\nkind: question\nquestion:\n  deadline: 9000\n  item: result.keyboard\n  reason: Review it\n  registeredAt: 1000\n  request: review\n  reviewedRevision: ${revision}\n  source: ${file}\n---\n${source}`,
		"responses/response.first.md": responseFile("response.first", question, revision, "first-reader", "clarify", 2000),
		...(earlier ? {} : { "responses/response.second.md": responseFile("response.second", question, revision, "second-reader", "answer", 3000) }),
	};
}
