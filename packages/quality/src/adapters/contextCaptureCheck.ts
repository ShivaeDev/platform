import ts from "typescript";
import { composedContext } from "#adapters/composedContext.ts";
import { effectApi } from "#adapters/serviceModelSyntax.ts";
import type { Finding, SourceFile, TypeScriptProgram } from "#rule.ts";
import { parse } from "#rules/parse.ts";
import { importBindings } from "#rules/stories/importBindings.ts";
import { memberName, nodesWhere, unwrapped } from "#rules/stories/syntax.ts";

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

const LAYER_NAME = /(?:Layer|Live)$|^layer$/u;

function aliasesIn(source: ts.SourceFile): ReadonlyMap<string, string> {
	const aliases = new Map(
		[...importBindings(source)].flatMap(([local, { imported }]) => (PROVIDERS.includes(imported) ? [[local, imported] as const] : [])),
	);
	for (const node of nodesWhere(source, (child) => ts.isBindingElement(child) || ts.isVariableDeclaration(child))) {
		if (ts.isBindingElement(node) && ts.isIdentifier(node.name)) {
			const property = node.propertyName ?? node.name;
			if (ts.isIdentifier(property) && PROVIDERS.includes(property.text)) {
				aliases.set(node.name.text, property.text);
			}
		} else if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && node.initializer !== undefined) {
			const api = apiOf(node.initializer, aliases);
			if (api !== undefined) {
				aliases.set(node.name.text, api);
			}
		}
	}
	return aliases;
}

function apiOf(callee: ts.Expression, aliases: ReadonlyMap<string, string>): string | undefined {
	const value = unwrapped(callee);
	const name = ts.isIdentifier(value) ? (aliases.get(value.text) ?? value.text) : memberName(value);
	return name !== undefined && PROVIDERS.includes(name) ? name : undefined;
}

function layerShaped(argument: ts.Expression): boolean {
	let root = unwrapped(argument);
	const name = ts.isIdentifier(root) ? root.text : memberName(root);
	while (ts.isCallExpression(root) || ts.isPropertyAccessExpression(root)) {
		root = unwrapped(root.expression);
	}
	return LAYER_NAME.test(name ?? "") || (ts.isIdentifier(root) && root.text === "Layer");
}

// Only these call shapes can re-provide a context, so a file without one never enters the type-checked program.
function candidate(file: SourceFile): boolean {
	const source =
		/(?:^|\/)(?:adapters|test-support)\//u.test(file.path) || !PROVIDERS.some((name) => file.text.includes(name)) ? undefined : parse(file);
	if (source === undefined) {
		return false;
	}
	const aliases = aliasesIn(source);
	return (
		nodesWhere(source, (node) => {
			const api = ts.isCallExpression(node) ? apiOf(node.expression, aliases) : undefined;
			const environment = ts.isCallExpression(node) ? node.arguments.at(-1) : undefined;
			return api !== undefined && (api !== "provide" || (environment !== undefined && !layerShaped(environment)));
		}).length > 0
	);
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

export const contextCaptureCheck = { checks: candidate, findings: findingsIn };
