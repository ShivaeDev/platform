import type { InboxProjection } from "#browser/views/schema.ts";

export const SOURCE_PROBLEMS_ID = "source-problems";

export function sourceProblemsSummary(issues: InboxProjection["issues"]) {
	const count = new Set(issues.map((issue) => issue.file)).size;
	return count === 1 ? "1 file has problems" : `${count} files have problems`;
}
