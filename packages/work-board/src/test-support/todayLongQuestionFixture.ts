const CONTEXT =
	"The release has a long history of implementation details, review notes and rollout evidence that the reader can consult before deciding. ";

export function todayLongQuestionFixture(mode: "text" | "one" = "text"): Record<string, string> {
	return {
		"home.md": "# Workspace notes\n",
		"release.md": `---
${JSON.stringify({
	attention: [
		{ id: "direction", kind: "decision", reason: CONTEXT.repeat(20), "response_from": ["maintainer"], state: "open", unblocks: ["decision.release"] },
	],
	id: "decision.release",
	kind: "question",
	scope: "task",
	urgency: "whenever",
})}
---
# Plan the release

${Array.from({ length: 20 }, (_, index) => `## Release context ${index + 1}\n\n${CONTEXT.repeat(3)}`).join("\n\n")}

::::question{id="release" select="${mode}"}
### When should we release?

${mode === "one" ? ':::option{id="monday"}\n### Monday\nThe team is available.\n:::\n:::option{id="friday"}\n### Friday\nAfter the review.\n:::\n' : ""}::::
`,
	};
}
