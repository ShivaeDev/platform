import { definePatternRule } from "./pattern-rule.ts";

export const noPrReference = definePatternRule({
	description: "History belongs in version control, not in the code. State the reason itself, so the comment holds without the link.",
	id: "comments/no-pr-reference",
	message: (match) => `Refers to a pull request or issue: "${match}".`,
	patterns: [
		/\b(?:PR|MR|pull request|merge request|issue|ticket)s?\s*#?\d+\b/iu,
		/\/(?:pull|pulls|issues|merge_requests)\/\d+/u,
		/\bGH-\d+\b/u,
		/(?<![\w&/#-])#\d+\b/u,
	],
});
