import { join } from "node:path";
import { Effect } from "effect";
import ts from "typescript";
import { serviceAssemblyImports } from "#adapters/serviceAssemblyImports.ts";
import { directServiceDefinitions } from "#adapters/serviceAssemblySyntax.ts";
import { serviceOperationProblems } from "#adapters/serviceOperationProblems.ts";
import { serviceStateProblems } from "#adapters/serviceStateProblems.ts";
import type { Finding, RuleInputs } from "#rule.ts";
import { effectProgram } from "#rules/effect/program.ts";
import { serviceCatalog } from "#rules/effect/serviceCatalog.ts";
import { parse } from "#rules/parse.ts";

function checkServices(inputs: RuleInputs): readonly Finding[] {
	const program = effectProgram(inputs);
	const checker = program.getTypeChecker();
	const services = serviceCatalog(program, checker, [], true);
	const found: Finding[] = [];
	for (const file of inputs.sources) {
		const source = program.getSourceFile(join(inputs.root, file.path));
		if (source === undefined) {
			continue;
		}
		for (const definition of directServiceDefinitions(source, serviceAssemblyImports(source).definitions)) {
			const config = definition.arguments[0];
			if (config === undefined || !ts.isObjectLiteralExpression(config)) {
				continue;
			}
			const problems = [...serviceStateProblems(checker, config, services), ...serviceOperationProblems(checker, config, source.fileName)];
			for (const { node, message } of problems) {
				found.push({ file: file.path, line: source.getLineAndCharacterOfPosition(node.getStart(source)).line + 1, message });
			}
		}
	}
	return found;
}

export const serviceModelFindings = Effect.fn("ServiceModel.serviceModelFindings")((inputs: RuleInputs) =>
	Effect.sync(() => {
		const groups = new Map<string, RuleInputs["sources"][number][]>();
		for (const file of inputs.sources) {
			const source = parse(file);
			if (source === undefined || directServiceDefinitions(source, serviceAssemblyImports(source).definitions).length === 0) {
				continue;
			}
			const group = /^(?:packages|examples)\/[^/]+/u.exec(file.path)?.[0] ?? ".";
			const sources = groups.get(group) ?? [];
			sources.push(file);
			groups.set(group, sources);
		}
		return [...groups.values()].flatMap((sources) => checkServices({ ...inputs, sources }));
	}),
);
