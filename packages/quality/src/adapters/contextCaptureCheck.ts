import { Effect } from "effect";
import ts from "typescript";
import { composedContext } from "#adapters/composedContext.ts";
import { effectApi } from "#adapters/serviceModelSyntax.ts";
import type { Finding, SourceFile, TypeScriptProgram } from "#rule.ts";

const RUNNERS = ["provideContext", "runPromiseWith", "runForkWith"];
const PROVIDERS = [...RUNNERS, "provide"];

function context(type: ts.Type): boolean {
	return type.isUnionOrIntersection() ? type.types.some(context) : type.getProperty("~effect/Context") !== undefined;
}

function reprovides(checker: ts.TypeChecker, call: ts.CallExpression): boolean {
	if (RUNNERS.some((name) => effectApi(checker, call.expression, name))) {
		return true;
	}
	if (!effectApi(checker, call.expression, "provide")) {
		return false;
	}
	const environment = call.arguments.at(-1);
	return environment !== undefined && context(checker.getTypeAtLocation(environment));
}

function candidate(file: SourceFile): boolean {
	return !/(?:^|\/)(?:adapters|test-support)\//u.test(file.path) && PROVIDERS.some((name) => file.text.includes(name));
}

function findingsIn(sources: readonly SourceFile[], { checker, sourceFile }: TypeScriptProgram): readonly Finding[] {
	return sources.flatMap((file): readonly Finding[] => {
		const source = sourceFile(file.path);
		if (source === undefined) {
			return [];
		}
		const syntax = source;
		const findings: Finding[] = [];
		function visit(node: ts.Node): void {
			const environment = ts.isCallExpression(node) ? node.arguments.at(-1) : undefined;
			if (ts.isCallExpression(node) && reprovides(checker, node) && !(environment !== undefined && composedContext(checker, environment))) {
				findings.push({
					file: file.path,
					line: syntax.getLineAndCharacterOfPosition(node.getStart(syntax)).line + 1,
					message:
						"Do not re-provide a captured Effect context in core code. Declare service requirements once and yield dependencies and the caller from the environment. Register the Layer at the host; put runtime bridges in adapters/ or test-support/.",
				});
			}
			ts.forEachChild(node, visit);
		}
		visit(source);
		return findings;
	});
}

export function contextCaptureCheck() {
	return Effect.succeed({ checks: candidate, findings: findingsIn });
}
