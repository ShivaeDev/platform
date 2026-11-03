import { join } from "node:path";
import { Effect } from "effect";
import ts from "typescript";
import { importGraph } from "#imports/graph.ts";
import { packageOf } from "#imports/workspace.ts";
import { isTestCode } from "#naming/testName.ts";
import type { RuleInputs } from "#rule.ts";
import { storyProgram } from "#rules/stories/program.ts";
import { nodesWhere } from "#rules/stories/syntax.ts";
import { readPackageManifest } from "./manifestInventory.ts";
import { queueTestingOrigin } from "./queueTestingOrigin.ts";

const MESSAGE =
	"Reads jobs-testing queue storage. An enqueued job or its state does not prove the work ran. Assert the application's visible result instead; use jobs-testing only to control and settle workers.";

export const queueReadoutFindings = Effect.fn("Stories.queueReadoutFindings")(function* (inputs: RuleInputs) {
	const graph = yield* importGraph(inputs);
	const root = yield* Effect.promise(() => readPackageManifest(inputs.readText, "package.json"));
	const program = storyProgram(inputs, graph);
	const origin = queueTestingOrigin(program.getTypeChecker());
	return inputs.sources.flatMap((file) => {
		const owner = packageOf(graph.packages, file.path)?.name ?? root?.name;
		if (!isTestCode(file.path) || owner === "@shivaedev/jobs") {
			return [];
		}
		const source = program.getSourceFile(join(inputs.root, file.path));
		if (source === undefined) {
			return [];
		}
		return nodesWhere(
			source,
			(node) =>
				((ts.isPropertyAccessExpression(node) || ts.isElementAccessExpression(node)) && origin(node) === "readout")
				|| (ts.isBindingElement(node) && origin(node) === "readout"),
		).map((node) => ({ file: file.path, line: source.getLineAndCharacterOfPosition(node.getStart(source)).line + 1, message: MESSAGE }));
	});
});
