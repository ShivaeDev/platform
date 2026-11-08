import { Effect } from "effect";
import { defineRule } from "@shivaedev/quality/rule.ts";
import { catalog } from "#quality/catalog.ts";

export const workspaceSection = defineRule({
	check: (inputs) => Effect.map(catalog(inputs), ({ findings }) => findings),
	description: "Write catalog, catalogs and overrides as indented block mappings.",
	id: "manifests/workspace-section",
});
