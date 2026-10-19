export const decisionId = `decision.${"a".repeat(64)}`;
export const decisionFile = `responses/${decisionId}.md`;
export const DECISION_REASON = "~~~markdown\n**Which publishing path should we take?** Read the [release guide](https://example.com/releases).\n~~~";
export const answerCardFixture = {
	"guide.md": "---\nid: task.guide\nkind: task\nstatus: blocked\n---\n# Publish the install guide\n\nKeep the release instructions clear.",
	"home.md": "# Project notes",
	[decisionFile]: `---
${JSON.stringify({
	attention: [
		{
			id: "direction",
			kind: "decision",
			managed: true,
			reason: DECISION_REASON,
			"response_from": ["maintainer"],
			state: "open",
			unblocks: ["task.guide"],
		},
	],
	id: decisionId,
	kind: "decision",
	options: [
		{ description: "Ship the reviewed guide with this release.", label: "Publish now" },
		{ description: "Keep the work blocked until another review.", label: "Wait for review" },
	],
	recommended: "Publish now",
	relationships: [{ kind: "relates_to", target: "task.guide" }],
})}
---
# Fleet decision for ${decisionId}

## Decision

${DECISION_REASON}

## Recommendation

~~~markdown
**Publish** the reviewed guide.
~~~

## Relevant links

<https://github.com/ShivaeDev/platform/pull/395>
`,
};

export const readyDecisionFixture = {
	...answerCardFixture,
	[decisionFile]:
		(answerCardFixture[decisionFile] ?? "")
			.replace(/"options":\[[\s\S]*?\],"recommended":"Publish now",/u, "")
			.replaceAll(
				JSON.stringify(DECISION_REASON),
				JSON.stringify("~~~markdown\n**Reviewed PR is ready to merge.** Read the [release guide](https://example.com/releases).\n~~~"),
			)
			.replaceAll(DECISION_REASON, "~~~markdown\n**Reviewed PR is ready to merge.** Read the [release guide](https://example.com/releases).\n~~~")
			.replace("**Publish** the reviewed guide.", "Merge the reviewed PR on GitHub.")
		+ `
::::question{id="fleet-action" select="one"}
### Do you want changes before merging?
:::option{id="retry"}
### Request changes
Write the changes in your answer. The worker makes them on the same branch and PR, then Fleet reviews and checks the PR again.
:::
:::option{id="release"}
### Stop and hand back
Fleet stops watching this PR and hands the task back to you. The PR stays open.
:::
::::
`,
};

export const PARAGRAPH_REASON = "**Which publishing path should we take?**\n\nRead the [release guide](https://example.com/releases).";
export const paragraphDecisionFixture = {
	...answerCardFixture,
	[decisionFile]: (answerCardFixture[decisionFile] ?? "")
		.replaceAll(JSON.stringify(DECISION_REASON), JSON.stringify(PARAGRAPH_REASON))
		.replace(DECISION_REASON, `Preserve this background before the decision.\n\n${PARAGRAPH_REASON}\n\nPreserve this conclusion after the decision.`),
};

export const TEXT_QUESTION_ID = "question.pooling";
export const textQuestionFixture = {
	"home.md": "# Project notes",
	"question.md": `---
id: ${TEXT_QUESTION_ID}
kind: question
status: open
next_action: Share your pooling design, or say to park it.
---
# Pooling design for the scale tests

The scale tests opened too many database connections.

Write the design in your answer: how connections are shared and what a scale test should prove.
`,
};
