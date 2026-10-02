import { definePatternRule } from "./pattern-rule.ts";

export const noPrReference = definePatternRule({
	id: "comments/no-pr-reference",
	description: "History belongs in version control, not in the code. State the reason itself, so the comment holds without the link.",
	patterns: [
		/\b(?:PR|MR|pull request|merge request|issue|ticket)s?\s*#?\d+\b/i,
		/\/(?:pull|pulls|issues|merge_requests)\/\d+/,
		/\bGH-\d+\b/,
		/(?<![\w&/#-])#\d+\b/,
	],
	message: (match) => `Refers to a pull request or issue: "${match}".`,
});
