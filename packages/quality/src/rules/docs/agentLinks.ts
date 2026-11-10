import { agentLinkFindings } from "#agentLinkFindings.ts";
import { defineRule } from "#rule.ts";

export const agentLinks = defineRule({
	check: agentLinkFindings,
	description: "Every AGENTS.md has a CLAUDE.md symlink beside it, and every CLAUDE.md points to that AGENTS.md.",
	id: "docs/agent-links",
});
