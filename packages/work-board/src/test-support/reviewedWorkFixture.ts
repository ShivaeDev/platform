export const reviewedDecisionId = `decision.${"c".repeat(64)}`;

const REVIEWED_TASK = `---
id: task.upload
kind: task
status: active
owner: codex
fleet: approved
next_action: Fleet starts it now.
criteria:
  - id: stable
    text: "The upload test passes 50 runs in a row."
  - id: cause
    text: "The pull request names the race."
relationships:
  - kind: implements
    target: goal.launch#guide
---
# Fix the flaky upload test

The upload test fails about once in twenty runs.`;

export function reviewedWorkFixture(reviewed = REVIEWED_TASK) {
	return {
		[`responses/${reviewedDecisionId}.md`]: `---
${JSON.stringify({
	attention: [
		{
			id: "task.upload.1",
			kind: "decision",
			managed: true,
			reason: "Reviewed PR is ready to merge",
			"response_from": ["maintainer"],
			state: "open",
			unblocks: ["task.upload"],
		},
	],
	id: reviewedDecisionId,
	kind: "decision",
	relationships: [{ kind: "relates_to", target: "task.upload" }],
})}
---
# Fleet decision for task.upload

## Decision

~~~
Reviewed PR is ready to merge
~~~

## Recommendation

~~~
Merge the reviewed PR
~~~

## Relevant links

<https://github.com/example/project/pull/12>

## Reviewed Board work

~~~
${reviewed}
~~~
`,
		"tasks/upload.md": REVIEWED_TASK,
	};
}
