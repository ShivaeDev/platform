import { viewsFixture } from "./viewsFixture.ts";

export function reasoningFixture(): Readonly<Record<string, string>> {
	const files = viewsFixture();
	return {
		...files,
		"boards/reasoning.md":
			"---\nid: board.reasoning\nkind: board\nitems: [result.search, plan.search, work.search, decision.search]\n---\n# Search reasoning\n",
		"decision.md": `${files["decision.md"]}\n## Options\n\n| Option | Tradeoff |\n| --- | --- |\n| Read files on every query | Simple but repeated parsing |\n| Rebuild a local index | Deterministic matching with watcher refresh |\n\n## Rationale\n\nPrefer a rebuildable local index; recorded claims remain distinct from acceptance.\n`,
		"notes/backlink & review.md":
			"# Review context\n\n[Result](../results/search.md#heading-evidence) and [home](/).\n\n[Rationale](/_board/item/decision.search/#heading-rationale).\n\n[Recorded claim][claim]\n\n[claim]: ../evidence.md\n\n[External](https://example.com/decision.md).\n\n`[Not a link](../decision.md)`\n",
		"plan.md":
			"---\nid: plan.search\nkind: project\nrelationships:\n  - kind: implements\n    target: decision.search\n---\n# Search plan\n\nUse the [browser record](evidence.md) as a recorded observation.\n",
		"results/search.md": `---\nid: result.search\nkind: result\nstatus: recorded\nrelationships:\n  - kind: implements\n    target: plan.search\n  - kind: depends_on\n    target: work.search#keyboard\n  - kind: relates_to\n    target: missing.id\nevidence:\n  - source: ../evidence.md\n    criterion: work.search#keyboard\n    checked_revision: "${"b".repeat(40)}"\n    observed_at: "2025-10-04T00:00:00Z"\n    method: browser walkthrough\n    outcome: passed\n  - source: ../missing%20evidence.md\n    checked_revision: "${"c".repeat(40)}"\n---\n# Search result\n\n## Evidence\n\nRead the [review context](../notes/backlink%20%26%20review.md).\n`,
	};
}
