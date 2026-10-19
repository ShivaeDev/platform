import { inboxAudienceFixture } from "./inboxAudienceFixture.ts";
import { todayFixture } from "./todayFixture.ts";

const FLEET_DECISION = `---
${JSON.stringify({
	attention: [
		{
			id: "task.ship.1",
			kind: "decision",
			managed: true,
			reason: "The PR passed review and all required checks. It is ready to merge.",
			"response_from": ["maintainer"],
			state: "open",
			unblocks: ["task.ship"],
		},
	],
	id: "decision.ship",
	kind: "decision",
	relationships: [{ kind: "relates_to", target: "task.ship" }],
})}
---
# Fleet decision for task.ship

::::question{id="fleet-action" select="one"}
### Do you want changes before merging?

:::option{id="retry"}
### Request changes
The worker makes the changes on the same branch and PR.
:::
:::option{id="release"}
### Stop and hand back
Fleet stops watching this PR. The PR stays open.
:::
::::
`;

export function todayRowsFixture(): Record<string, string> {
	return {
		...todayFixture(),
		"responses/decision.ship.md": FLEET_DECISION,
		"tasks/policy.md":
			'---\nid: docs.policy\nkind: task\nstatus: dropped\nowner: maintainer\nnext_action: "Dropped: every export is supported API."\n---\n# Is every module supported API?\n',
		"tasks/ship.md": "---\nid: task.ship\nkind: task\nstatus: active\nowner: codex\n---\n# Ship the upload fix\n",
	};
}

export function todayTextAskFixture(): Record<string, string> {
	return { "home.md": "# Workspace notes\n", "reader.md": inboxAudienceFixture()["reader.md"] ?? "" };
}
