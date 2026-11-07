import ts from "typescript";
import { fakeApi, type fakeReferences } from "#adapters/imports/fakeReferences.ts";
import { fakeImplementation } from "#rules/stories/fakeImplementation.ts";
import { memberName, unwrapped } from "#rules/stories/syntax.ts";

const REPLACEMENTS = new Set([
	"mockImplementation",
	"mockImplementationOnce",
	"mockReturnValue",
	"mockReturnValueOnce",
	"mockResolvedValue",
	"mockResolvedValueOnce",
	"mockRejectedValue",
	"mockRejectedValueOnce",
	"mockReturnThis",
	"withImplementation",
]);

const SERVICES = new Set(["Layer.succeed", "Layer.sync", "Layer.effect", "Layer.mock", "Effect.provideService", "Effect.provideServiceEffect"]);

export function fakeReplacements(source: ts.SourceFile, references: ReturnType<typeof fakeReferences>): readonly ts.Expression[] {
	const replaced: ts.Expression[] = [];
	function spy(expression: ts.Expression, seen = new Set<ts.Node>()): ts.CallExpression | undefined {
		const node = unwrapped(expression);
		if (seen.has(node)) {
			return undefined;
		}
		seen.add(node);
		if (ts.isCallExpression(node)) {
			if (fakeApi(references.reference(node.expression)) === "vi.spyOn") {
				return node;
			}
			return ts.isPropertyAccessExpression(node.expression) ? spy(node.expression.expression, seen) : undefined;
		}
		if (ts.isIdentifier(node)) {
			const declaration = references.initializer(node);
			return declaration === undefined ? undefined : spy(declaration, seen);
		}
		return undefined;
	}
	function service(node: ts.CallExpression): ts.Expression | undefined {
		const curried = ts.isCallExpression(node.expression) ? node.expression : undefined;
		const construction = curried ?? node;
		const api = fakeApi(references.reference(construction.expression));
		if (api === undefined || !SERVICES.has(api)) {
			return undefined;
		}
		const index = api.startsWith("Effect.") && construction.arguments.length === 3 ? 1 : 0;
		const argument = construction.arguments[index];
		const value = curried === undefined ? node.arguments[index + 1] : node.arguments[0];
		return argument !== undefined && value !== undefined && references.concreteService(argument) && fakeImplementation(value, references)
			? argument
			: undefined;
	}
	function replacementSpy(node: ts.CallExpression): ts.Expression | undefined {
		return REPLACEMENTS.has(memberName(node.expression) ?? "")
			&& (ts.isPropertyAccessExpression(node.expression) || ts.isElementAccessExpression(node.expression))
			? spy(node.expression.expression)?.arguments[0]
			: undefined;
	}
	function visit(node: ts.Node): void {
		if (ts.isCallExpression(node)) {
			for (const target of [service(node), replacementSpy(node)]) {
				if (target !== undefined) {
					replaced.push(target);
				}
			}
		}
		ts.forEachChild(node, visit);
	}

	visit(source);
	return replaced;
}
