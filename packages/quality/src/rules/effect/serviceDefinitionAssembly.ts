import type ts from "typescript";
import { indirectServiceReferences } from "#adapters/indirectServiceReferences.ts";
import { serviceAssemblyImports } from "#adapters/serviceAssemblyImports.ts";
import { directServiceDefinitions, implementationBodies } from "#adapters/serviceAssemblySyntax.ts";
import { serviceDefinitionProblems } from "#adapters/serviceDefinitionProblems.ts";
import { defineRule, type Finding, type SourceFile } from "#rule.ts";
import { parse } from "#rules/parse.ts";

function fileFindings(file: SourceFile): readonly Finding[] {
	const source = parse(file);
	if (source === undefined) {
		return [];
	}
	const imports = serviceAssemblyImports(source);
	if (imports.definitions.size === 0 && imports.unsupported.length === 0) {
		return [];
	}
	const definitions = directServiceDefinitions(source, imports.definitions);
	const found = imports.unsupported.map((node) => ({ message: "Import and call defineService directly.", node }));
	for (const node of indirectServiceReferences(source, imports.definitions, definitions)) {
		found.push({ message: "Call the imported defineService directly in a top-level service declaration.", node });
	}
	if (imports.definitions.size > 0 && definitions.length === 0) {
		found.push({ message: "Call the imported defineService directly in a top-level service declaration.", node: source });
	}
	const allowedBodies = new Set<ts.Node>();
	for (const definition of definitions) {
		found.push(...serviceDefinitionProblems(definition, imports.effects, imports.values, allowedBodies, imports.generics));
	}
	for (const node of implementationBodies(source, allowedBodies)) {
		found.push({ message: "Move this implementation body to a named export in its own focused file.", node });
	}
	return found.map(({ node, message }) => ({
		file: file.path,
		line: source.getLineAndCharacterOfPosition(node.getStart(source)).line + 1,
		message,
	}));
}

export const serviceDefinitionAssembly = defineRule({
	check: ({ sources }) => sources.flatMap(fileFindings),
	description:
		"Keep defineService declarations as top-level operation inventories: list id, requires, initialize and methods directly. Import a named initializer (or use Effect.void) and named Effect.fn operations from focused files; state factories capture only owned lifetime state; genericMethod may wrap those references. Move implementation bodies out of the assembly file. The service-model rule verifies tracing and owned state. Includes adapters and tests; no config exceptions or inline suppressions.",
	id: "effect/service-definition-assembly",
	registrable: false,
});
