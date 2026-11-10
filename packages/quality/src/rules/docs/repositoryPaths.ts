import { repositoryPathFindings } from "#repositoryPathFindings.ts";
import { defineRule } from "#rule.ts";

export const repositoryPaths = defineRule({
	check: repositoryPathFindings,
	description:
		"Repository paths in Markdown backticks exist. Check explicit relative paths and paths beneath known repository folders; leave examples, globs, commands and URLs alone.",
	id: "docs/repository-paths",
});
