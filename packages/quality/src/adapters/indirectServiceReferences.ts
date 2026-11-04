import ts from "typescript";
import { unwrapExpression } from "#adapters/serviceAssemblySyntax.ts";

export function indirectServiceReferences(
	source: ts.SourceFile,
	names: ReadonlySet<string>,
	definitions: readonly ts.CallExpression[],
): readonly ts.Node[] {
	const direct = new Set(definitions.map((definition) => unwrapExpression(definition.expression)));
	const found: ts.Node[] = [];
	function visit(node: ts.Node): void {
		if (
			ts.isIdentifier(node)
			&& names.has(node.text)
			&& !direct.has(node)
			&& !ts.isImportSpecifier(node.parent)
			&& !ts.isPropertyAccessExpression(node.parent)
		) {
			found.push(node);
		}
		ts.forEachChild(node, visit);
	}
	visit(source);
	return found;
}
