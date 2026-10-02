import { definePatternRule } from "./pattern-rule.ts";

const SOURCE_EXTENSION =
	"(?:[cm]?[jt]sx?|json5?|mdx?|css|scss|less|html?|vue|svelte|astro|ya?ml|toml|sql|prisma|graphql|gql|go|rs|py|rb|java|kt|swift|sh)";

export const noLineReference = definePatternRule({
	id: "comments/no-line-reference",
	description: "A line number goes stale with the next edit. Name the function, type, test or setting instead.",
	patterns: [new RegExp(`[\\w./@-]*\\.${SOURCE_EXTENSION}(?::\\d+|#L\\d+)`, "i"), /(?<![\w-])lines?\s+\d+/i],
	message: (match) => `Refers to a line: "${match}".`,
});
