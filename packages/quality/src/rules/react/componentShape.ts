import ts from "typescript";

const WRAPPERS: ReadonlySet<string> = new Set(["forwardRef", "memo"]);

export type Definable = ts.ArrowFunction | ts.ClassLikeDeclaration | ts.FunctionDeclaration | ts.FunctionExpression | ts.MethodDeclaration;

function calleeName(call: ts.CallExpression): string | undefined {
	const callee = call.expression;
	const name = ts.isPropertyAccessExpression(callee) ? callee.name : callee;
	return ts.isIdentifier(name) ? name.text : undefined;
}

export function unwrapped(node: ts.Expression): ts.Expression {
	if (ts.isParenthesizedExpression(node) || ts.isAsExpression(node) || ts.isSatisfiesExpression(node)) {
		return unwrapped(node.expression);
	}
	const [inner] = ts.isCallExpression(node) && WRAPPERS.has(calleeName(node) ?? "") ? node.arguments : [];
	return inner === undefined ? node : unwrapped(inner);
}

function rendersJsx(node: ts.Expression): boolean {
	const value = unwrapped(node);
	if (ts.isJsxElement(value) || ts.isJsxSelfClosingElement(value) || ts.isJsxFragment(value)) {
		return true;
	}
	if (ts.isConditionalExpression(value)) {
		return rendersJsx(value.whenTrue) || rendersJsx(value.whenFalse);
	}
	if (ts.isBinaryExpression(value)) {
		return rendersJsx(value.left) || rendersJsx(value.right);
	}
	if (ts.isArrayLiteralExpression(value)) {
		return value.elements.some(rendersJsx);
	}
	return ts.isCallExpression(value) && (calleeName(value) === "createElement" || value.arguments.some(rendersJsx));
}

export function returnsJsx(definition: Definable): boolean {
	if (ts.isClassLike(definition)) {
		return definition.members.some(
			(member) => ts.isMethodDeclaration(member) && ts.isIdentifier(member.name) && member.name.text === "render" && returnsJsx(member),
		);
	}
	if (definition.body === undefined || !ts.isBlock(definition.body)) {
		return definition.body !== undefined && rendersJsx(definition.body);
	}
	let found = false;
	function visit(node: ts.Node): void {
		if (ts.isReturnStatement(node) && node.expression !== undefined && rendersJsx(node.expression)) {
			found = true;
		}
		if (!(found || ts.isFunctionLike(node) || ts.isClassLike(node))) {
			ts.forEachChild(node, visit);
		}
	}
	ts.forEachChild(definition.body, visit);
	return found;
}

export function renderedReference(node: ts.Node): ts.Identifier | undefined {
	if ((ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) && ts.isIdentifier(node.tagName)) {
		return node.tagName;
	}
	if (ts.isJsxAttribute(node) && node.initializer !== undefined && ts.isJsxExpression(node.initializer)) {
		const value = node.initializer.expression;
		return value !== undefined && ts.isIdentifier(value) ? value : undefined;
	}
	const [first] = ts.isCallExpression(node) && calleeName(node) === "createElement" ? node.arguments : [];
	return first !== undefined && ts.isIdentifier(first) ? first : undefined;
}
