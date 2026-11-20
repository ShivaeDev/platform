import ts from "typescript";
import { nameAt } from "#imports/packageName.ts";
import { bridgedLibraryCall } from "#rules/effect/promiseBridge.ts";

const INSTALLED = "/node_modules/";

// A Promise subclass, an intersection with one or a thenable query builder awaits like a Promise, whatever its name.
function thenable(checker: ts.TypeChecker, type: ts.Type): boolean {
	if (type.isUnion()) {
		return type.types.some((member) => thenable(checker, member));
	}
	const then = checker.getPropertyOfType(type, "then");
	return then !== undefined && checker.getTypeOfSymbol(then).getCallSignatures().length > 0;
}

function unwrapped(node: ts.Node): ts.Node {
	return ts.isParenthesizedExpression(node.parent) ? unwrapped(node.parent) : node;
}

function awaitedOrThen(node: ts.CallExpression): boolean {
	const outer = unwrapped(node);
	const parent = outer.parent;
	if (ts.isAwaitExpression(parent)) {
		return true;
	}
	return ts.isPropertyAccessExpression(parent) && parent.name.text === "then" && ts.isCallExpression(parent.parent);
}

function thenCall(node: ts.CallExpression): boolean {
	return ts.isPropertyAccessExpression(node.expression) && node.expression.name.text === "then";
}

function hostGlobal(node: ts.Node): boolean {
	const scope = ts.findAncestor(node.parent, ts.isModuleDeclaration);
	if (scope === undefined) {
		return !ts.isExternalModule(node.getSourceFile());
	}
	return (scope.flags & ts.NodeFlags.GlobalAugmentation) !== 0 || (!ts.isStringLiteral(scope.name) && hostGlobal(scope));
}

function libraryDeclared(program: ts.Program, workspace: ReadonlySet<string>, declaration: ts.Node): boolean {
	const file = declaration.getSourceFile();
	const at = file.fileName.lastIndexOf(INSTALLED);
	const name = at < 0 ? undefined : nameAt(file.fileName.slice(at + INSTALLED.length));
	return (
		name !== undefined
		&& !(name === "effect" || name.startsWith("@effect/") || name.startsWith("@shivaedev/") || workspace.has(name))
		&& !program.isSourceFileDefaultLibrary(file)
		&& !hostGlobal(declaration)
	);
}

function calleeSignatures(checker: ts.TypeChecker, callee: ts.Expression): readonly ts.Signature[] {
	const type = checker.getNonNullableType(checker.getTypeAtLocation(callee));
	return (type.isUnion() ? type.types : [type]).flatMap((member) => member.getCallSignatures());
}

// The syntax half already reports a Promise that is awaited, chained with then or bridged from an imported library, so those calls give no second finding. Only a callee with a library signature is resolved, which keeps Effect and workspace calls cheap, and a global is the host's API whichever declarations describe it.
export function promiseCall(program: ts.Program, workspace: ReadonlySet<string>) {
	const checker = program.getTypeChecker();
	const bridged = bridgedLibraryCall(checker, workspace);
	function declared(candidate: ts.Signature): boolean {
		return candidate.declaration !== undefined && libraryDeclared(program, workspace, candidate.declaration);
	}
	return (node: ts.Node): string | undefined => {
		if (
			!ts.isCallExpression(node)
			|| node.expression.kind === ts.SyntaxKind.ImportKeyword
			|| thenCall(node)
			|| awaitedOrThen(node)
			|| bridged(node)
		) {
			return undefined;
		}
		if (!calleeSignatures(checker, node.expression).some(declared)) {
			return undefined;
		}
		const signature = checker.getResolvedSignature(node);
		return signature !== undefined && declared(signature) && thenable(checker, checker.getReturnTypeOfSignature(signature))
			? `${node.expression.getText()}(...), a library call that returns a Promise`
			: undefined;
	};
}
