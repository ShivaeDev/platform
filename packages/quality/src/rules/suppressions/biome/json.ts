import ts from "typescript";

export type Json =
	| { readonly _tag: "Object"; readonly line: number; readonly entries: ReadonlyMap<string, Json> }
	| { readonly _tag: "Array"; readonly line: number; readonly items: readonly Json[] }
	| { readonly _tag: "Value"; readonly line: number; readonly value: string | boolean | undefined };

export type Parsed = { readonly _tag: "Parsed"; readonly json: Json } | { readonly _tag: "Unreadable"; readonly reason: string };

const LITERALS: ReadonlyMap<ts.SyntaxKind, boolean> = new Map([
	[ts.SyntaxKind.TrueKeyword, true],
	[ts.SyntaxKind.FalseKeyword, false],
]);

const scalarOf = (node: ts.Expression): string | boolean | undefined => (ts.isStringLiteral(node) ? node.text : LITERALS.get(node.kind));

const entryOf = (source: ts.JsonSourceFile, property: ts.ObjectLiteralElementLike): ReadonlyArray<readonly [string, Json]> =>
	ts.isPropertyAssignment(property) && (ts.isStringLiteral(property.name) || ts.isIdentifier(property.name))
		? [[property.name.text, toJson(source, property.initializer)]]
		: [];

const toJson = (source: ts.JsonSourceFile, node: ts.Expression): Json => {
	const line = source.getLineAndCharacterOfPosition(node.getStart(source)).line + 1;
	if (ts.isObjectLiteralExpression(node)) {
		return { _tag: "Object", entries: new Map(node.properties.flatMap((property) => entryOf(source, property))), line };
	}
	if (ts.isArrayLiteralExpression(node)) {
		return { _tag: "Array", items: node.elements.map((element) => toJson(source, element)), line };
	}
	return { _tag: "Value", line, value: scalarOf(node) };
};

export const parseJsonc = (path: string, text: string): Parsed => {
	const error = ts.parseConfigFileTextToJson(path, text).error;
	const source = ts.parseJsonText(path, text);
	const root = source.statements[0]?.expression;
	if (error !== undefined || root === undefined) {
		return {
			_tag: "Unreadable",
			reason: error === undefined ? "it is empty" : ts.flattenDiagnosticMessageText(error.messageText, " ").replace(/\.$/u, ""),
		};
	}
	return { _tag: "Parsed", json: toJson(source, root) };
};

export const member = (node: Json | undefined, key: string): Json | undefined => (node?._tag === "Object" ? node.entries.get(key) : undefined);

export const entriesOf = (node: Json | undefined): ReadonlyArray<readonly [string, Json]> => (node?._tag === "Object" ? [...node.entries] : []);

export const itemsOf = (node: Json | undefined): readonly Json[] => (node?._tag === "Array" ? node.items : []);

export const textOf = (node: Json | undefined): string | undefined =>
	node?._tag === "Value" && typeof node.value === "string" ? node.value : undefined;

export const isFalse = (node: Json | undefined): boolean => node?._tag === "Value" && node.value === false;
