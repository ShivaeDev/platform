import { Effect } from "effect";
import { importGraph } from "#imports/graph.ts";
import { testCode } from "#naming/testCode.ts";
import { defineRule } from "#rule.ts";

export const noTestCode = defineRule({
	check: Effect.fn("Imports.check")(function* (inputs) {
		const graph = yield* importGraph(inputs);
		const isTestCode = yield* testCode(inputs);
		return graph.edges
			.filter((edge) => !isTestCode(edge.from) && edge.to.kind === "file" && isTestCode(edge.to.path))
			.map((edge) => ({
				file: edge.from,
				line: edge.line,
				message: `Imports test code through "${edge.specifier}". Move the shared code into a production module and import it from both production and tests.`,
				subject: edge.specifier,
			}));
	}),
	description:
		"Production modules import production code. Private test-composition packages may be consumed by tests, test support and package development scripts. Move shared production code out of test files and test-support/ into a production module.",
	id: "imports/no-test-code",
	registrable: false,
});
