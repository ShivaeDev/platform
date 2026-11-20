import ts from "typescript";
import { type Definable, renderedReference, returnsJsx, unwrapped } from "#rules/react/componentShape.ts";

const COMPONENT_NAME = /^[A-Z]/u;
const HOOK_NAME = /^use[A-Z0-9]/u;

interface Candidate {
	readonly definition: Definable;
	readonly key: boolean;
	readonly name: ts.Identifier | ts.StringLiteral;
}

export interface NestedDefinition {
	readonly hook: boolean;
	readonly name: ts.Identifier | ts.StringLiteral;
}

function definable(node: ts.Expression | undefined): Definable | undefined {
	const value = node === undefined ? undefined : unwrapped(node);
	return value !== undefined && (ts.isArrowFunction(value) || ts.isFunctionExpression(value) || ts.isClassExpression(value)) ? value : undefined;
}

function candidateOf(node: ts.Node): Candidate | undefined {
	if ((ts.isFunctionDeclaration(node) || ts.isClassDeclaration(node)) && node.name !== undefined) {
		return { definition: node, key: false, name: node.name };
	}
	const definition = ts.isVariableDeclaration(node) || ts.isPropertyAssignment(node) ? definable(node.initializer) : undefined;
	if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && definition !== undefined) {
		return { definition, key: false, name: node.name };
	}
	const key = ts.isPropertyAssignment(node) || ts.isMethodDeclaration(node) ? node.name : undefined;
	const value = ts.isMethodDeclaration(node) && ts.isObjectLiteralExpression(node.parent) ? node : definition;
	return key !== undefined && (ts.isIdentifier(key) || ts.isStringLiteral(key)) && value !== undefined
		? { definition: value, key: true, name: key }
		: undefined;
}

function method(node: ts.SignatureDeclaration): boolean {
	const render = ts.isMethodDeclaration(node) && ts.isIdentifier(node.name) && node.name.text === "render";
	return !render && (ts.isMethodDeclaration(node) || ts.isConstructorDeclaration(node) || ts.isAccessor(node));
}

function moduleMock(node: ts.Node): boolean {
	const call = node.parent;
	if (!(ts.isCallExpression(call) && ts.isPropertyAccessExpression(call.expression) && ts.isIdentifier(call.expression.expression))) {
		return false;
	}
	return ["jest", "vi"].includes(call.expression.expression.text) && ["doMock", "mock"].includes(call.expression.name.text);
}

function higherOrder(node: ts.SignatureDeclaration): boolean {
	return node.parameters.some((parameter) => ts.isIdentifier(parameter.name) && COMPONENT_NAME.test(parameter.name.text));
}

// Like Biome's rules, a method other than render, a module mock factory and a higher-order component that takes a component build what they define once.
function enclosingFunction(node: ts.Node): ts.Node | undefined {
	for (let parent = node.parent; parent !== undefined; parent = parent.parent) {
		if (ts.isFunctionLike(parent)) {
			return method(parent) || moduleMock(parent) || higherOrder(parent) ? undefined : parent;
		}
	}
	return undefined;
}

export function nestedDefinitions(source: ts.SourceFile): readonly NestedDefinition[] {
	const candidates: (Candidate & { readonly scope: ts.Node })[] = [];
	const rendered: ts.Identifier[] = [];
	function visit(node: ts.Node): void {
		const candidate = candidateOf(node);
		const scope = candidate === undefined ? undefined : enclosingFunction(node);
		if (candidate !== undefined && scope !== undefined) {
			candidates.push({ ...candidate, scope });
		}
		const reference = renderedReference(node);
		if (reference !== undefined) {
			rendered.push(reference);
		}
		ts.forEachChild(node, visit);
	}
	visit(source);
	function renderedIn(name: string, scope: ts.Node): boolean {
		return rendered.some((reference) => reference.text === name && reference.pos >= scope.pos && reference.end <= scope.end);
	}
	return candidates.flatMap(({ definition, key, name, scope }) => {
		if (!key && HOOK_NAME.test(name.text) && !ts.isClassLike(definition)) {
			return [{ hook: true, name }];
		}
		const component = COMPONENT_NAME.test(name.text) && (returnsJsx(definition) || (!key && renderedIn(name.text, scope)));
		return component ? [{ hook: false, name }] : [];
	});
}
