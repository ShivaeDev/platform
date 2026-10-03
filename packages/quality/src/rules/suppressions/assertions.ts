import ts from "typescript";
import type { SourceFile } from "../../rule.ts";
import { parse } from "../syntax.ts";

export type Assertion = ts.AsExpression | ts.TypeAssertion;

const BRIDGES: ReadonlyMap<ts.SyntaxKind, string> = new Map([
	[ts.SyntaxKind.UnknownKeyword, "unknown"],
	[ts.SyntaxKind.AnyKeyword, "any"],
	[ts.SyntaxKind.NeverKeyword, "never"],
]);

const isAssertion = (node: ts.Node): node is Assertion => ts.isAsExpression(node) || ts.isTypeAssertionExpression(node);

const unwrapped = (node: ts.Expression): ts.Expression => (ts.isParenthesizedExpression(node) ? unwrapped(node.expression) : node);

export interface Bridge {
	readonly inner: Assertion;
	readonly through: string;
}

export const bridgeOf = (node: Assertion): Bridge | undefined => {
	const inner = unwrapped(node.expression);
	const through = isAssertion(inner) ? BRIDGES.get(inner.type.kind) : undefined;
	return isAssertion(inner) && through !== undefined ? { inner, through } : undefined;
};

export interface Assertions {
	readonly source: ts.SourceFile;
	readonly assertions: ReadonlyArray<Assertion>;
}

export const assertionsIn = (file: SourceFile): Assertions | undefined => {
	const source = parse(file);
	if (source === undefined) {
		return undefined;
	}
	const assertions: Assertion[] = [];
	const visit = (node: ts.Node): void => {
		if (isAssertion(node)) {
			assertions.push(node);
		}
		ts.forEachChild(node, visit);
	};
	visit(source);
	return { assertions, source };
};

export const lineOf = (source: ts.SourceFile, node: ts.Node): number => source.getLineAndCharacterOfPosition(node.getStart(source)).line + 1;
