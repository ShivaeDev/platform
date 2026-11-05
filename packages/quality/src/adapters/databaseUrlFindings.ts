import { join } from "node:path";
import { Effect } from "effect";
import { importGraph } from "#imports/graph.ts";
import { isTestSupport } from "#naming/testName.ts";
import type { RuleInputs } from "#rule.ts";
import { findingAt } from "#rules/stories/syntax.ts";
import { databaseUrlReads } from "./databaseUrlReads.ts";
import { storyProgram } from "./storyProgram.ts";

const MESSAGE =
	"Reads a *DATABASE_URL variable directly in test-support. Use postgresTestUrl(name) from @shivaedev/test-sql/server/adapters/postgresTestUrl.ts so missing PostgreSQL URLs fail in CI instead of silently skipping tests.";

export const databaseUrlFindings = Effect.fn("Stories.databaseUrlFindings")(function* (inputs: RuleInputs) {
	const graph = yield* importGraph(inputs);
	const program = storyProgram(inputs, graph);
	const checker = program.getTypeChecker();
	return inputs.sources
		.filter((file) => isTestSupport(file.path))
		.flatMap((file) => {
			const source = program.getSourceFile(join(inputs.root, file.path));
			return source === undefined ? [] : databaseUrlReads(source, checker).map((node) => ({ ...findingAt(source, node, MESSAGE), file: file.path }));
		});
});
