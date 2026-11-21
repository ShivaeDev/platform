import ts from "typescript";
import type { CodePart, ImportFact } from "#facts.ts";

export interface Copying {
	readonly checker: ts.TypeChecker;
	// Names the copied part in a refusal, such as "notes.get reads".
	readonly label: string;
	readonly refuse: (message: string) => void;
}

const LOCAL_DECLARATIONS = new Set([
	ts.SyntaxKind.VariableDeclaration,
	ts.SyntaxKind.FunctionDeclaration,
	ts.SyntaxKind.ClassDeclaration,
	ts.SyntaxKind.InterfaceDeclaration,
	ts.SyntaxKind.TypeAliasDeclaration,
	ts.SyntaxKind.EnumDeclaration,
	ts.SyntaxKind.ModuleDeclaration,
	ts.SyntaxKind.Parameter,
	ts.SyntaxKind.BindingElement,
]);

type ImportBinding = ts.ImportSpecifier | ts.ImportClause | ts.NamespaceImport;

function importBinding(declaration: ts.Declaration): ImportBinding | undefined {
	return ts.isImportSpecifier(declaration) || ts.isImportClause(declaration) || ts.isNamespaceImport(declaration) ? declaration : undefined;
}

function clauseOf(binding: ImportBinding): ts.ImportClause {
	if (ts.isImportClause(binding)) {
		return binding;
	}
	return ts.isNamespaceImport(binding) ? binding.parent : binding.parent.parent;
}

function importedName(binding: ImportBinding): string {
	if (ts.isImportClause(binding)) {
		return "default";
	}
	return ts.isNamespaceImport(binding) ? "*" : (binding.propertyName ?? binding.name).text;
}

function importFact(copying: Copying, binding: ImportBinding, local: string): ImportFact | undefined {
	const clause = clauseOf(binding);
	const declaration = clause.parent;
	if (!ts.isStringLiteral(declaration.moduleSpecifier)) {
		return undefined;
	}
	const specifier = declaration.moduleSpecifier.text;
	const file = declaration.getSourceFile().fileName;
	if (specifier.startsWith(".")) {
		copying.refuse(
			`${copying.label} imports ${local} by the relative path "${specifier}" in ${file}; import it through a package import, such as a # specifier, so the generated file can import it too`,
		);
		return undefined;
	}
	const name = importedName(binding);
	const target = copying.checker.getSymbolAtLocation(declaration.moduleSpecifier)?.valueDeclaration?.getSourceFile().fileName;
	const typeOnly = clause.isTypeOnly || (ts.isImportSpecifier(binding) && binding.isTypeOnly);
	return { local, name, specifier, target, typeOnly, writtenIn: file };
}

function referenceOf(copying: Copying, node: ts.Node, identifier: ts.Identifier): ImportFact | "local" | undefined {
	const symbol = ts.isShorthandPropertyAssignment(identifier.parent)
		? copying.checker.getShorthandAssignmentValueSymbol(identifier.parent)
		: copying.checker.getSymbolAtLocation(identifier);
	const declaration = symbol?.declarations?.[0];
	if (declaration === undefined) {
		return undefined;
	}
	const binding = importBinding(declaration);
	if (binding !== undefined) {
		return importFact(copying, binding, identifier.text);
	}
	const inside = declaration.pos >= node.pos && declaration.end <= node.end;
	const sameFile = declaration.getSourceFile() === node.getSourceFile();
	return sameFile && !inside && LOCAL_DECLARATIONS.has(declaration.kind) ? "local" : undefined;
}

// The code as written, with each imported name kept as its import, so the generated file can import and rename it.
export function copiedCode(copying: Copying, node: ts.Node): readonly CodePart[] {
	const source = node.getSourceFile();
	const parts: CodePart[] = [];
	let position = node.getStart(source);
	function visit(child: ts.Node) {
		if (ts.isIdentifier(child)) {
			const reference = referenceOf(copying, node, child);
			if (reference === "local") {
				copying.refuse(
					`${copying.label} uses ${child.text}, which is declared in ${source.fileName}; move it to a module the operation imports it from, such as the module's model file`,
				);
			} else if (reference !== undefined) {
				const shorthand = ts.isShorthandPropertyAssignment(child.parent) ? `${child.text}: ` : "";
				parts.push(source.text.slice(position, child.getStart(source)) + shorthand, reference);
				position = child.end;
			}
		}
		ts.forEachChild(child, visit);
	}
	visit(node);
	parts.push(source.text.slice(position, node.end));
	return parts.filter((part) => part !== "");
}
