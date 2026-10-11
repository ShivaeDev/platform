import { importGraph } from "#imports/graph.ts";
import { isTestCode } from "#naming/testName.ts";
import { defineRule } from "#rule.ts";

export const noTestCode = defineRule({
	check: async (inputs) =>
		(await importGraph(inputs)).edges
			.filter((edge) => !isTestCode(edge.from) && edge.to.kind === "file" && isTestCode(edge.to.path))
			.map((edge) => ({
				file: edge.from,
				line: edge.line,
				message: `Imports test code through "${edge.specifier}". Move the shared code into a production module and import it from both production and tests.`,
				subject: edge.specifier,
			})),
	description: "Production modules import production code. Move shared code out of test files and test-support/ into a production module.",
	id: "imports/no-test-code",
	registrable: false,
});
