import { defineRule } from "@shivaedev/quality/rule.ts";
import { catalog } from "./catalog.ts";

export const workspaceSection = defineRule({
	check: async (inputs) => (await catalog(inputs)).findings,
	description: "Write catalog, catalogs and overrides as indented block mappings.",
	id: "manifests/workspace-section",
});
