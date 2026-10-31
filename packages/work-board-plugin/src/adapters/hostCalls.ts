import ts from "typescript";

export interface TopLevel {
	readonly fromEngine: ReadonlySet<string>;
	readonly fromOwnFiles: ReadonlySet<string>;
	readonly functions: ReadonlyMap<string, ts.FunctionDeclaration>;
}

function imported(statement: ts.Statement): { readonly names: readonly string[]; readonly source: string } | undefined {
	if (!(ts.isImportDeclaration(statement) && ts.isStringLiteral(statement.moduleSpecifier))) {
		return undefined;
	}
	const bindings = statement.importClause?.namedBindings;
	const names = bindings !== undefined && ts.isNamedImports(bindings) ? bindings.elements.map((element) => element.name.text) : [];
	return { names, source: statement.moduleSpecifier.text };
}

export function topLevel(file: ts.SourceFile): TopLevel {
	const functions = new Map<string, ts.FunctionDeclaration>();
	const fromEngine = new Set<string>();
	const fromOwnFiles = new Set<string>();
	for (const statement of file.statements) {
		if (ts.isFunctionDeclaration(statement) && statement.name !== undefined) {
			functions.set(statement.name.text, statement);
		}
		const names = imported(statement);
		for (const name of names?.names ?? []) {
			(names?.source === "claude-code" ? fromEngine : fromOwnFiles).add(name);
		}
	}
	return { fromEngine, fromOwnFiles, functions };
}

export function onCallRefusal(call: ts.CallExpression): string | undefined {
	const args = call.arguments;
	const [event, matcher] = args;
	const hook = args.at(-1);
	if (args.some(ts.isSpreadElement) || (args.length !== 2 && args.length !== 3)) {
		return "on is called with other than (event, hook) or (event, matcher, hook)";
	}
	if (event === undefined || !ts.isStringLiteral(event)) {
		return "on names its event other than as a string literal";
	}
	if (args.length === 3 && !(matcher !== undefined && ts.isObjectLiteralExpression(matcher))) {
		return `on("${event.text}") takes its matcher other than as an object written in the call`;
	}
	if (hook === undefined || !(ts.isArrowFunction(hook) || ts.isFunctionExpression(hook))) {
		return `on("${event.text}") takes a hook that is not a function literal`;
	}
	const [engine] = hook.parameters;
	if (engine !== undefined && !(ts.isIdentifier(engine.name) && engine.name.text === "$")) {
		return `on("${event.text}") takes a hook whose first parameter is not named $`;
	}
	if (hook.parameters.some((parameter) => parameter.initializer !== undefined || parameter.dotDotDotToken !== undefined)) {
		return `on("${event.text}") takes a hook with a default or rest parameter`;
	}
	return undefined;
}

function nounRefusal(noun: ts.PropertyAccessExpression): string | undefined {
	const method = noun.parent;
	const call = method.parent;
	const spelled =
		noun.questionDotToken === undefined
		&& ts.isPropertyAccessExpression(method)
		&& method.expression === noun
		&& method.questionDotToken === undefined
		&& call !== undefined
		&& ts.isCallExpression(call)
		&& call.expression === method;
	return spelled ? undefined : `$.${noun.name.text} is used other than as $.noun.method(...)`;
}

function argumentRefusal(node: ts.Identifier, call: ts.CallExpression, callee: string, names: TopLevel): string | undefined {
	if (names.fromEngine.has(callee)) {
		return call.arguments[0] === node ? undefined : `$ is passed to ${callee} other than as its first argument`;
	}
	if (names.functions.has(callee) || names.fromOwnFiles.has(callee)) {
		return undefined;
	}
	return `$ is passed to ${callee}, which is not a function declared at the top of this file`;
}

export function engineUseRefusal(node: ts.Identifier, names: TopLevel): string | undefined {
	const parent = node.parent;
	if (ts.isParameter(parent) && parent.name === node) {
		return undefined;
	}
	if (ts.isPropertyAccessExpression(parent) && parent.expression === node) {
		return nounRefusal(parent);
	}
	if (ts.isCallExpression(parent) && parent.arguments.includes(node) && ts.isIdentifier(parent.expression)) {
		return argumentRefusal(node, parent, parent.expression.text, names);
	}
	return "$ is used other than as $.noun.method(...) or as an argument to a function declared at the top of this file";
}

export function nextToRefusal(node: ts.PropertyAccessExpression): string | undefined {
	const call = node.parent;
	if (!(ts.isCallExpression(call) && call.expression === node)) {
		return 'next.to is used other than as next.to(e, "<tier>")';
	}
	const [, tier] = call.arguments;
	return call.arguments.length === 2 && tier !== undefined && ts.isStringLiteral(tier)
		? undefined
		: 'next.to is used other than as next.to(e, "<tier>")';
}
