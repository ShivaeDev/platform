import { inboxQuestion } from "./inboxFixture.ts";

export function itemFixture(): Readonly<Record<string, string>> {
	return {
		"compatibility.md": "# Compatibility notes\n\n[Release plan](release.md).\n",
		"home.md": "# Project notes\n\n## Work\n\n### Read the release plan\n",
		"plain.md": "An ordinary note without a heading.\n",
		"question.md": inboxQuestion,
		"release.md":
			"---\nid: work.release\nkind: task\nstatus: in-review\nowner: editor\nnext_action: Review the compatibility notes\ncriteria:\n  - id: review\n    text: Compatibility reviewed\n---\n# **Release** plan\n\nRead the [compatibility notes][notes] before approving.\n\n## Evidence\n\nThe source records a review request.\n\n[notes]: compatibility.md\n",
		"unknown.md": "---\nid: work.unknown\nkind: task\n---\nA preamble remains readable.\n\n# Unknown status\n\n## Evidence\n\n## Unknown status\n",
	};
}
