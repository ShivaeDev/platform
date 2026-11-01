import { Effect } from "effect";
import { adminFindings } from "#imports/adminFindings.ts";
import { importGraph } from "#imports/graph.ts";
import { defineRule } from "#rule.ts";

export const adminPaths = defineRule({
	check: (inputs) => Effect.promise(() => importGraph(inputs)).pipe(Effect.map((graph) => adminFindings(graph, inputs.sources))),
	description:
		"Admin-only source files live under an admin/ segment; member code cannot reach admin/ implementations. Registration and module composition may import admin registrations and declarations. Move the file to the folder named by the finding.",
	id: "imports/admin-paths",
	registrable: false,
});
