import ts from "typescript";
import { serviceAssemblyImports } from "#adapters/serviceAssemblyImports.ts";
import { directServiceDefinitions } from "#adapters/serviceAssemblySyntax.ts";
import { serviceOperationProblems } from "#adapters/serviceOperationProblems.ts";
import { serviceStateProblems } from "#adapters/serviceStateProblems.ts";
import type { Finding, SourceFile, TypeScriptProgram } from "#rule.ts";
import { serviceCatalog } from "#rules/effect/serviceCatalog.ts";
import { parse } from "#rules/parse.ts";

function definesServices(file: SourceFile): boolean {
	const source = file.text.includes("defineService") ? parse(file) : undefined;
	return source !== undefined && directServiceDefinitions(source, serviceAssemblyImports(source).definitions).length > 0;
}

function checkServices(sources: readonly SourceFile[], { checker, program, sourceFile }: TypeScriptProgram): readonly Finding[] {
	const services = serviceCatalog(program, checker, [], true);
	const found: Finding[] = [];
	for (const file of sources) {
		const source = sourceFile(file.path);
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

export const serviceModelCheck = { checks: definesServices, findings: checkServices };
