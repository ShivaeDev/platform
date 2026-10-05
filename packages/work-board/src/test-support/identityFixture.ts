export function identityFixture(): Readonly<Record<string, string>> {
	return {
		"decision.md":
			"---\nid: decision.search\nkind: decision\nstatus: proposed\nrelationships:\n  - kind: informs\n    target: work.search\n---\n# Deterministic search\n\nCompare options in ordinary Markdown.\n",
		"evidence.md": "# Browser walkthrough\n\nThis fixture describes a recorded claim, not a verified result.\n",
		"items/search & review.md": `---\nid: work.search\nkind: task\nstatus: in-review\nowner: agent-navigation\nnext_action: Review keyboard evidence\ncriteria:\n  - id: keyboard\n    text: Escape returns focus to its opening control\n  - id: passage\n    text: Duplicate heading navigation reaches the correct passage\nrelationships:\n  - kind: implements\n    target: decision.search\nevidence:\n  - source: ../evidence.md\n    criterion: work.search#keyboard\n    checked_revision: "${"a".repeat(40)}"\n    observed_at: "2026-10-05T00:00:00Z"\n    method: browser\n    outcome: passed\n---\n# Search the workspace\n\nReadable project prose.\n\n<details>\n<summary>Review notes</summary>\n\nPreserve this section through updates.\n\n</details>\n`,
		"legacy.md": "# Existing board\n\n## In review\n\n### Plain item\n\nNo identity or status is inferred from this section.\n",
	};
}
