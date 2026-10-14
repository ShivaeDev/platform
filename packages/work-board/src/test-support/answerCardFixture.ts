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

Publish the reviewed guide.
`,
};
