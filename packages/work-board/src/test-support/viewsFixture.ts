import { identityFixture } from "./identityFixture.ts";

export function viewsFixture(): Readonly<Record<string, string>> {
	return {
		...identityFixture(),
		"boards/review.md": "---\nid: board.review\nitems: [work.search, work.other, work.unassigned]\n---\n# Review work\n",
		"boards/shared.md": "---\nid: board.shared\nitems: [work.search, decision.search]\n---\n# Shared investigation\n",
		"items/other.md": "---\nid: work.other\nkind: report\nstatus: done\nowner: claude\nnext_action: Check source revision\n---\n# Another result\n",
		"items/unassigned.md": "---\nid: work.unassigned\nkind: task\n---\n# Unassigned work\n",
	};
}
