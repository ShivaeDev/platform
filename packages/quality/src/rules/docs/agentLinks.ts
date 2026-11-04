import { agentLinkFindings } from "#adapters/agentLinkFindings.ts";
import { defineRule } from "#rule.ts";

export const agentLinks = defineRule({
	check: agentLinkFindings,
	description: "Every CLAUDE.md is a symlink to the AGENTS.md file beside it.",
	id: "docs/agent-links",
});
