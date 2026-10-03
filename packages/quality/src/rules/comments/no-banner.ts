import { definePatternRule } from "./pattern-rule.ts";

const DIVIDER = "[-=*#~_+/\\\\─━═┄┈]{3,}";

export const noBanner = definePatternRule({
	description: "Banners, dividers and regions mark a file that does several jobs. Split the file along those sections instead.",
	id: "comments/no-banner",
	message: (match) => `Banner or divider: "${match}".`,
	patterns: [new RegExp(`^${DIVIDER}|${DIVIDER}$`, "m"), /^#(?:end)?region\b/m],
});
