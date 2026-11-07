import ts from "typescript";
import { importedCall } from "#adapters/importedCall.ts";

function isImportMeta(node: ts.Expression): boolean {
	return ts.isMetaProperty(node) && node.keywordToken === ts.SyntaxKind.ImportKeyword && node.name.text === "meta";
}

export function moduleResolver(call: ts.CallExpression): "meta" | "require" | undefined {
	const callee = call.expression;
	if (!ts.isPropertyAccessExpression(callee) || callee.name.text !== "resolve") {
		return undefined;
	}
	if (ts.isIdentifier(callee.expression) && callee.expression.text === "require") {
		return "require";
	}
	if (ts.isCallExpression(callee.expression)) {
		const factory = importedCall(callee.expression);
		if (factory?.name === "createRequire" && /^(?:node:)?module$/u.test(factory.module)) {
			return "require";
		}
	}
	return isImportMeta(callee.expression) ? "meta" : undefined;
}
