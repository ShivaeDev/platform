import { identityFixture } from "./identityFixture.ts";

export function viewsFixture(): Readonly<Record<string, string>> {
	return {
		...identityFixture(),
		"boards/review.md": "---\nid: board.review\nkind: board\nitems: [work.search, work.other, work.unassigned]\n---\n# Review work\n",
		"boards/shared.md": "---\nid: board.shared\nkind: board\nitems: [work.search, decision.search]\n---\n# Shared investigation\n",
		"items/other.md":
			"---\nid: work.other\nkind: result\nstatus: done\nowner: agent-evidence\nnext_action: Check source revision\n---\n# Another result\n",
		"items/unassigned.md": "---\nid: work.unassigned\nkind: task\n---\n# Unassigned work\n",
	};
}
