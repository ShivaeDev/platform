import { Effect } from "effect";
import ts from "typescript";
import type { Finding, RuleInputs, SourceFile, TypeScriptProgram } from "#rule.ts";
import { parse } from "#rules/parse.ts";
import { SQL_ROW_CAST } from "#rules/suppressions/hiddenCast.ts";
import { readonlyWrite, writeCandidate } from "#rules/suppressions/readonlyWrite.ts";
import { skipsUnsafeFolder } from "#rules/unsafeFindings.ts";

function typedNodes(source: ts.SourceFile): readonly ts.Node[] {
	const nodes: ts.Node[] = [];
	function visit(node: ts.Node): void {
		if (writeCandidate(node) || (ts.isTaggedTemplateExpression(node) && node.typeArguments?.length && node.tag.getText() !== "sql")) {
			nodes.push(node);
		}
		ts.forEachChild(node, visit);
	}
	visit(source);
	return nodes;
}

function typedCast(node: ts.Node, checker: ts.TypeChecker): string | undefined {
	if (ts.isTaggedTemplateExpression(node)) {
		const nativeSql = checker
			.getTypeAtLocation(node.tag)
			.getSymbol()
			?.getDeclarations()
			?.some((declaration) =>
				/(?:^|\/)effect\/(?:src|dist(?:\/[^/]+)?)\/sql\/(?:SqlClient|Statement)\.(?:d\.)?ts$/u.test(declaration.getSourceFile().fileName),
			);
		return nativeSql ? SQL_ROW_CAST : undefined;
	}
	return readonlyWrite(node, checker);
}

function candidate(file: SourceFile): boolean {
	const source = parse(file);
	return source !== undefined && typedNodes(source).length > 0;
}

function typedCasts(sources: readonly SourceFile[], { checker, sourceFile }: TypeScriptProgram): readonly Finding[] {
	return sources.flatMap((file) => {
		const source = sourceFile(file.path);
		return source === undefined
			? []
			: typedNodes(source).flatMap((node) => {
					const message = typedCast(node, checker);
					return message === undefined
						? []
						: [{ file: file.path, line: source.getLineAndCharacterOfPosition(node.getStart(source)).line + 1, message }];
				});
	});
}

export function typedCastCheck(inputs: RuleInputs) {
	return Effect.withSpan(
		Effect.succeed({ checks: (file: SourceFile) => !skipsUnsafeFolder(inputs, file.path) && candidate(file), findings: typedCasts }),
		"Suppressions.typedCastCheck",
	);
}
