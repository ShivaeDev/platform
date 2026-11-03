import ts from "typescript";
import { memberName, unwrapped } from "#rules/stories/syntax.ts";

const WRITES = new Set([
	"insert",
	"insertVoid",
	"insertOrIgnore",
	"insertMany",
	"insertManyOrIgnore",
	"insertFromSelect",
	"insertFromSelectOrIgnore",
	"update",
	"updateVoid",
	"upsert",
	"upsertMany",
	"delete",
	"deleteBatched",
]);

function sqlModule(path: string): boolean {
	return /\/(?:@shivaedev\/)?sql\/(?:src|dist)\//u.test(path.replaceAll("\\", "/"));
}

export function transactionChanges(checker: ts.TypeChecker, body: ts.Expression): boolean {
	const seen = new Set<ts.Node>();
	function repositoryWrite(expression: ts.Expression, name: string | undefined): boolean {
		if (!WRITES.has(name ?? "")) {
			return false;
		}
		const purge = checker.getTypeAtLocation(expression).getProperty("deleteBatched");
		return purge?.declarations?.some((declaration) => sqlModule(declaration.getSourceFile().fileName)) ?? false;
	}
	function bindingWrite(declaration: ts.BindingElement): boolean {
		if (!ts.isVariableDeclaration(declaration.parent.parent)) {
			return false;
		}
		const value = declaration.parent.parent.initializer;
		const property = declaration.propertyName ?? declaration.name;
		return value !== undefined && repositoryWrite(value, ts.isIdentifier(property) ? property.text : undefined);
	}
	function declarationChanges(declaration: ts.Declaration, name: string): boolean {
		const source = declaration.getSourceFile();
		if (sqlModule(source.fileName)) {
			return ["transact", "invalidateOnCommit"].includes(name) && /\/transact\.(?:d\.)?ts$/u.test(source.fileName);
		}
		if (source.isDeclarationFile || source.fileName.includes("/node_modules/")) {
			return false;
		}
		if (ts.isVariableDeclaration(declaration)) {
			return declaration.initializer !== undefined && visit(declaration.initializer);
		}
		if (ts.isFunctionDeclaration(declaration)) {
			return declaration.body !== undefined && visit(declaration.body);
		}
		if (ts.isBindingElement(declaration)) {
			return bindingWrite(declaration);
		}
		return false;
	}
	function reference(node: ts.Identifier): boolean {
		const symbol = checker.getSymbolAtLocation(node);
		if (symbol === undefined) {
			return false;
		}
		const target = symbol.flags & ts.SymbolFlags.Alias ? checker.getAliasedSymbol(symbol) : symbol;
		return target.declarations?.some((declaration) => declarationChanges(declaration, target.name)) ?? false;
	}
	function visit(node: ts.Node): boolean {
		if (seen.has(node) || ts.isTypeNode(node)) {
			return false;
		}
		seen.add(node);
		if (ts.isIdentifier(node) && reference(node)) {
			return true;
		}
		if (
			(ts.isPropertyAccessExpression(node) || ts.isElementAccessExpression(node))
			&& repositoryWrite(unwrapped(node.expression), memberName(node))
		) {
			return true;
		}
		return ts.forEachChild(node, (child) => visit(child) || undefined) ?? false;
	}
	return visit(body);
}
