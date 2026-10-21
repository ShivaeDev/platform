import { closedInboxFixture } from "./closedInboxFixture.ts";
import { inboxAudienceFixture } from "./inboxAudienceFixture.ts";

export function attentionLanesFixture(maintainer = "maintainer"): Record<string, string> {
	const addressed = inboxAudienceFixture(maintainer);
	return {
		...Object.fromEntries(Object.entries(closedInboxFixture()).filter(([file]) => file !== "question.md")),
		...addressed,
		"automation.md": addressed["orchestrator.md"]?.replaceAll("orchestrator", "automation") ?? "",
		"owner.md": "---\nid: task.person\nowner: marvin\nnext_action: Read the evidence\n---\n# Human action\n",
		"unknown.md": "---\nid: note.unknown\nunknown_field: yes\n---\n# Unknown metadata\n",
		"unresolved.md": "---\nid: note.unresolved\nrelationships:\n  - kind: depends_on\n    target: absent.item\n---\n# Missing reference\n",
	};
}
