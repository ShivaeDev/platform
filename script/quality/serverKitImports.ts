import { Effect } from "effect";
import { outgoing, reachedFrom } from "@shivaedev/quality/imports/fences/reach.ts";
import { importGraph } from "@shivaedev/quality/imports/graph.ts";
import { defineRule } from "@shivaedev/quality/rule.ts";

export const serverKitImports = defineRule({
	check: (inputs) =>
		Effect.gen(function* () {
			const graph = yield* Effect.promise(() => importGraph(inputs));
			const edges = outgoing(graph.edges);
			return graph.modules
				.filter((path) => path.startsWith("packages/server/src/test-support/"))
				.flatMap((file) =>
					reachedFrom(file, edges, (target) => target.kind === "file" && target.path.startsWith("packages/identity/src/test-support/")).map(
						(reached) => ({
							file,
							line: reached.line,
							message: `Reaches identity's private test kit through ${reached.path.join(" -> ")}. Use public identity APIs and shared test-sql plumbing.`,
						}),
					),
				);
		}),
	description: "Server kits use public identity APIs and shared test kits instead of identity's private fixtures.",
	id: "imports/server-kits",
});
