import { Effect } from "effect";
import ts from "typescript";
import { importGraph } from "#imports/graph.ts";
import { defineRule } from "#rule.ts";
import type { Origin } from "./collectionOrigins.ts";
import { storyOrigins } from "./origins.ts";
import { retryOption } from "./retryOption.ts";
import { memberName, nodesWhere } from "./syntax.ts";

const BUILDERS = new Set(["each", "for", "extend", "runIf", "skipIf", "layer"]);
const MESSAGE =
	"Declares a test or suite retry. Remove the retry option: retries are global only and recorded by vitest-rerun, so flakes stay visible.";

function optionsOf(call: ts.CallExpression, origin: Origin): readonly ts.Expression[] {
	if (origin === "story") {
		return call.arguments.slice(3, 4);
	}
	return origin === "plain" || origin === "suite" ? call.arguments.slice(1, 3) : [];
}

export const globalRetries = defineRule({
	check: (inputs) =>
		Effect.gen(function* () {
			const graph = yield* Effect.promise(() => importGraph(inputs));
			const origins = storyOrigins(inputs, graph);
			const retry = retryOption(origins.checker);
			return inputs.sources.flatMap((file) => {
				const source = origins.source(file.path);
				if (source === undefined) {
					return [];
				}
				const findings = nodesWhere(source, (node) => {
					if (!ts.isCallExpression(node) || BUILDERS.has(memberName(node.expression) ?? "")) {
						return false;
					}
					if (!node.arguments.slice(1, 4).some((argument) => retry(argument))) {
						return false;
					}
					return optionsOf(node, origins.origin(node.expression)).some((argument) => retry(argument));
				});
				return findings.map((node) => ({
					file: file.path,
					line: source.getLineAndCharacterOfPosition(node.getStart(source)).line + 1,
					message: MESSAGE,
				}));
			});
		}),
	description: "Test, suite and story retries are global only and recorded by vitest-rerun; registrations declare no retry option.",
	id: "tests/global-retries",
});
