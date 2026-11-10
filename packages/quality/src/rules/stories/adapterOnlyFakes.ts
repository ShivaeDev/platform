import { Effect } from "effect";
import ts from "typescript";
import { fakeApi, fakeReferences } from "#adapters/imports/fakeReferences.ts";
import { type FakeModule, fakeTargets } from "#adapters/imports/fakeTargets.ts";
import { storyProgram } from "#adapters/storyProgram.ts";
import { importGraph } from "#imports/graph.ts";
import { inAdapters } from "#naming/inAdapters.ts";
import { isTestCode } from "#naming/testName.ts";
import { defineRule, type Finding } from "#rule.ts";
import { fakeReplacements } from "#rules/stories/fakeReplacements.ts";

// effect/adapter-bridges keeps every adapters/ file a bridge to an outside system, so faking one fakes that system.
function internal(path: string): boolean {
	return !inAdapters(path);
}

function message(target: string): string {
	return `Replaces owned code in ${target} outside adapters/. Exercise the real module or service; fake only adapters/ or outside libraries and platform globals. Delete a test whose failure can only be shown by faking internals.`;
}

export const adapterOnlyFakes = defineRule({
	check: Effect.fn("Stories.check")(function* (inputs) {
		const graph = yield* importGraph(inputs);
		const program = storyProgram(inputs, graph);
		const references = fakeReferences(program, inputs.root);
		const modules: FakeModule[] = [];
		const findings: Finding[] = [];
		for (const file of inputs.sources.filter((candidate) => isTestCode(candidate.path))) {
			const source = references.source(file.path);
			if (source === undefined) {
				continue;
			}
			const syntax = source;
			function line(node: ts.Node): number {
				return syntax.getLineAndCharacterOfPosition(node.getStart(syntax)).line + 1;
			}
			function visit(node: ts.Node): void {
				if (ts.isCallExpression(node) && ["vi.mock", "vi.doMock"].includes(fakeApi(references.reference(node.expression)) ?? "")) {
					const argument = node.arguments[0];
					const name =
						argument !== undefined && ts.isCallExpression(argument) && argument.expression.kind === ts.SyntaxKind.ImportKeyword
							? argument.arguments[0]
							: argument;
					if (name !== undefined && ts.isStringLiteralLike(name)) {
						modules.push({ file: file.path, line: line(node), specifier: name.text });
					}
				}
				ts.forEachChild(node, visit);
			}
			visit(source);
			for (const node of fakeReplacements(source, references)) {
				const target = references.owner(node, true);
				if (target !== undefined && internal(target)) {
					findings.push({ file: file.path, line: line(node), message: message(target) });
				}
			}
		}
		return [
			...findings,
			...fakeTargets(inputs, modules)
				.filter(({ target }) => internal(target))
				.map(({ file, line, target }) => ({ file, line, message: message(target) })),
		];
	}),
	description: "Tests fake only adapters, outside libraries and platform globals; owned modules and services run for real.",
	id: "tests/adapter-only-fakes",
	registrable: false,
});
