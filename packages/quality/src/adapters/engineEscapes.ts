import { posix } from "node:path";
import ts from "typescript";
import { isTestSupport, testName } from "#naming/testName.ts";
import { engineOf } from "#rules/stories/engineOf.ts";
import { memberName, unwrapped } from "#rules/stories/syntax.ts";
import type { BodyReference } from "./bodyReference.ts";
import { bodyReferences, storyBody } from "./bodyReferences.ts";
import { serviceAccess } from "./serviceAccess.ts";

export interface EngineEscape {
	readonly node: ts.Node;
	readonly reason: string;
}

function production({ file, module }: BodyReference): boolean {
	return (
		!(isTestSupport(file ?? module) || module.startsWith("@shivaedev/test"))
		&& (/^[.#/]/u.test(module)
			|| module.startsWith("@shivaedev/")
			|| engineOf({ kind: "external", package: module, specifier: module }) !== undefined)
	);
}

function constructorTest(file: string, reference: BodyReference): boolean {
	const name = testName(file);
	const target = reference.file ?? posix.join(posix.dirname(file), reference.module);
	return name !== undefined && target.endsWith(`/${posix.join(name.folder, name.stem)}${name.extension}`);
}

function constructorCall(node: ts.CallExpression | ts.NewExpression, called: BodyReference): boolean {
	const name = called.path.at(-1) ?? "";
	return (
		called.kind === "import"
		&& production(called)
		&& (ts.isNewExpression(node) || /^(?:(?:make|create|build)[A-Z]|make$|create$|build$|defineService$|layer(?:$|[A-Z]))/u.test(name))
	);
}

export function engineEscapes(body: ts.Expression, checker: ts.TypeChecker, file: string) {
	const declaration = storyBody(body, checker);
	if (declaration?.body === undefined) {
		return { drivesSubject: false, escapes: [] };
	}
	const reference = bodyReferences(declaration, checker);
	const block = declaration.body;
	const escapes: EngineEscape[] = [];
	let drivesSubject = false;
	function transactionHandle(node: ts.Node, value: BodyReference): boolean {
		if (!((value.module === "effect/sql/SqlClient" || value.module === "effect/sql") && value.path.at(-1) === "SqlClient")) {
			return false;
		}
		const yielded = node.parent;
		const binding = yielded.parent;
		if (!(ts.isYieldExpression(yielded) && ts.isVariableDeclaration(binding) && ts.isIdentifier(binding.name))) {
			return false;
		}
		const name = binding.name;
		const symbol = checker.getSymbolAtLocation(name);
		const uses: ts.Identifier[] = [];
		function collect(current: ts.Node): void {
			if (ts.isIdentifier(current) && current !== name && checker.getSymbolAtLocation(current) === symbol) {
				uses.push(current);
			}
			ts.forEachChild(current, collect);
		}
		collect(block);
		return (
			uses.length > 0
			&& uses.every(
				(use) =>
					(ts.isPropertyAccessExpression(use.parent) || ts.isElementAccessExpression(use.parent))
					&& use.parent.expression === use
					&& memberName(use.parent) === "withTransaction",
			)
		);
	}
	function accessReason(node: ts.Node): string | undefined {
		const value = reference(node);
		if (value?.kind === "told" && value.path[0] === "story" && value.path[1] === "engine") {
			return "Reads story.engine";
		}
		if (value === undefined || !serviceAccess(node, value, reference)) {
			return undefined;
		}
		if (transactionHandle(node, value)) {
			drivesSubject = true;
			return undefined;
		}
		return "Reads a raw service handle";
	}
	function checkConstructor(node: ts.CallExpression | ts.NewExpression): void {
		const called = reference(unwrapped(node.expression));
		if (called === undefined || !constructorCall(node, called)) {
			return;
		}
		if (constructorTest(file, called)) {
			drivesSubject = true;
		} else {
			escapes.push({ node, reason: "Calls a production constructor" });
		}
	}
	function visit(node: ts.Node): void {
		if (ts.isTypeNode(node)) {
			return;
		}
		if (ts.isIdentifier(node) || ts.isPropertyAccessExpression(node) || ts.isElementAccessExpression(node)) {
			const reason = accessReason(node);
			if (reason !== undefined) {
				escapes.push({ node, reason });
				return;
			}
		}
		if (ts.isCallExpression(node) || ts.isNewExpression(node)) {
			checkConstructor(node);
		}
		ts.forEachChild(node, visit);
	}
	visit(declaration.body);
	return { drivesSubject, escapes: escapes.filter((found, index) => escapes.findIndex((other) => other.reason === found.reason) === index) };
}
