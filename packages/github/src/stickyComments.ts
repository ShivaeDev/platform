import { upsertStickyComment } from "#operations/upsertStickyComment.ts";
import type { Representations } from "#representations.ts";

export function stickyComments(client: Representations) {
	return { upsertStickyComment: upsertStickyComment(client) };
}
