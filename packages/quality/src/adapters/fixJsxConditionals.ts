import ts from "typescript";
import type { SourceFile } from "#rule.ts";
import { parse } from "#rules/parse.ts";

interface Edit {
	readonly end: number;
	readonly start: number;
	readonly text: string;
}

function unwrap(node: ts.Expression): ts.Expression {
	return ts.isParenthesizedExpression(node) ? unwrap(node.expression) : node;
}

function conditionalChild(node: ts.Expression): ts.Expression | undefined {
	const value = unwrap(node);
	if (!(ts.isJsxElement(value) || ts.isJsxFragment(value))) {
		return undefined;
	}
	if (ts.isJsxElement(value)) {
		const { tagName, attributes } = value.openingElement;
		if (!(ts.isIdentifier(tagName) && /^[a-z]/u.test(tagName.text)) || attributes.properties.length > 0) {
			return undefined;
		}
	}
	const children = value.children.filter((item) => !ts.isJsxText(item) || item.text.trim() !== "");
	if (children.length !== 1) {
		return undefined;
	}
	const child = children[0];
	if (child !== undefined && (ts.isJsxElement(child) || ts.isJsxFragment(child))) {
		return conditionalChild(child);
	}
	if (child === undefined || !ts.isJsxExpression(child) || child.expression === undefined) {
		return undefined;
	}
	const expression = unwrap(child.expression);
	return isConditional(expression) ? child.expression : undefined;
}

function isConditional(expression: ts.Expression): boolean {
	return (
		ts.isConditionalExpression(expression)
		|| (ts.isBinaryExpression(expression) && expression.operatorToken.kind === ts.SyntaxKind.AmpersandAmpersandToken)
	);
}

function returnedExpression(node: ts.Node): ts.Expression | undefined {
	if (ts.isReturnStatement(node)) {
		return node.expression;
	}
	return ts.isArrowFunction(node) && !ts.isBlock(node.body) ? node.body : undefined;
}

function mapped(node: ts.Node): boolean {
	return ts.isCallExpression(node) && ts.isPropertyAccessExpression(node.expression) && node.expression.name.text === "map";
}

function manualDecision(node: ts.Node): boolean {
	return (
		(ts.isIdentifier(node) && node.text === "eval") || mapped(node) || ts.forEachChild(node, (child) => manualDecision(child) || undefined) === true
	);
}

function returnText(source: ts.SourceFile, node: ts.Node, expression: ts.Expression, rendered: string): string {
	if (ts.isReturnStatement(node)) {
		return source.text.slice(node.getStart(source), expression.getStart(source)) + rendered + source.text.slice(expression.end, node.end);
	}
	return `return ${rendered};`;
}

export function fixJsxConditionals(file: SourceFile): string {
	const parsed = parse(file);
	if (parsed === undefined) {
		return file.text;
	}
	const source = parsed;
	const names = new Set<string>();
	function namesIn(node: ts.Node): void {
		if (ts.isIdentifier(node)) {
			names.add(node.text);
		}
		ts.forEachChild(node, namesIn);
	}
	namesIn(source);
	let name = "qualityContent";
	for (let suffix = 1; names.has(name); suffix += 1) {
		name = `qualityContent${suffix}`;
	}
	const edits: Edit[] = [];
	function visit(node: ts.Node): void {
		if (mapped(node)) {
			return;
		}
		const expression = returnedExpression(node);
		const child = expression === undefined ? undefined : conditionalChild(expression);
		if (expression !== undefined && child !== undefined && !manualDecision(expression)) {
			const rendered = file.text.slice(expression.getStart(source), child.getStart(source)) + name + file.text.slice(child.end, expression.end);
			const start = ts.isReturnStatement(node) ? node.getStart(source) : expression.getStart(source);
			const returned = returnText(source, node, expression, rendered);
			edits.push({
				end: ts.isReturnStatement(node) ? node.end : expression.end,
				start,
				text: `{ const ${name} = ${child.getText(source)}; ${returned} }`,
			});
			return;
		}
		ts.forEachChild(node, visit);
	}
	visit(source);
	let text = file.text;
	for (const edit of edits.toSorted((left, right) => right.start - left.start)) {
		text = text.slice(0, edit.start) + edit.text + text.slice(edit.end);
	}
	return text;
}
