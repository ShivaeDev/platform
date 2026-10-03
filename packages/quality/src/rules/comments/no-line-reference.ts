import { definePatternRule } from "./pattern-rule.ts";

const SOURCE_EXTENSION =
	"(?:[cm]?[jt]sx?|json5?|mdx?|css|scss|less|html?|vue|svelte|astro|ya?ml|toml|sql|prisma|graphql|gql|go|rs|py|rb|java|kt|swift|sh)";

export const noLineReference = definePatternRule({
	description: "A line number goes stale with the next edit. Name the function, type, test or setting instead.",
	id: "comments/no-line-reference",
	message: (match) => `Refers to a line: "${match}".`,
	patterns: [new RegExp(`[\\w./@-]*\\.${SOURCE_EXTENSION}(?::\\d+|#L\\d+)`, "iu"), /(?<![\w-])lines?\s+\d+/iu],
});
