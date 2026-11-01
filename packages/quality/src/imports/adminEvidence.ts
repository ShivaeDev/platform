import ts from "typescript";
import type { SourceFile } from "#rule.ts";
import { parse } from "#rules/parse.ts";
import { type AdminBindings, adminBindings } from "./adminBindings.ts";

export function sourceRoot(path: string): string | undefined {
	return /^(?:.*\/)?src\//u.exec(path)?.[0];
}

export function adminPath(path: string): boolean {
	const root = sourceRoot(path);
	return root !== undefined && path.slice(root.length).split("/").includes("admin");
}

export function composition(path: string): boolean {
	return /(?:^|\/)(?:registration|modules)\.[cm]?[jt]sx?$/u.test(path);
}

function adminCall(node: ts.CallExpression, bindings: AdminBindings): boolean {
	if (ts.isIdentifier(node.expression) && bindings.factories.has(node.expression.text)) {
		return true;
	}
	const expression = ts.isCallExpression(node.expression) ? node.expression.expression : node.expression;
	const callee = ts.isPropertyAccessExpression(expression) ? expression.name.text : expression.getText();
	return bindings.guards.has(callee) && node.arguments.some((argument) => ts.isIdentifier(argument) && bindings.permissions.has(argument.text));
}

function exportedRegistration(node: ts.Node): boolean {
	if (!(ts.isFunctionDeclaration(node) || ts.isVariableStatement(node))) {
		return false;
	}
	const exported = node.modifiers?.some((modifier) => modifier.kind === ts.SyntaxKind.ExportKeyword);
	const names = ts.isFunctionDeclaration(node)
		? [node.name?.text]
		: node.declarationList.declarations.map((declaration) => declaration.name.getText());
	return exported === true && names.includes("adminRegistration");
}

export function adminEvidence(file: SourceFile): boolean {
	const source = parse(file);
	if (source === undefined) {
		return false;
	}
	const bindings = adminBindings(source);
	let found = false;
	function visit(node: ts.Node): void {
		found ||= (ts.isCallExpression(node) && adminCall(node, bindings)) || exportedRegistration(node);
		ts.forEachChild(node, visit);
	}
	visit(source);
	return found;
}
