import ts from "typescript";
import { nameAt } from "#imports/packageName.ts";
import { bridgedLibraryCall } from "#rules/effect/promiseBridge.ts";

const INSTALLED = "/node_modules/";

function promised(type: ts.Type): boolean {
	return ["Promise", "PromiseLike"].includes(type.getSymbol()?.name ?? "") || (type.isUnion() && type.types.some(promised));
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

// A global is the host's API whichever declarations describe it, as with TypeScript's default library.
function hostGlobal(node: ts.Node): boolean {
	const scope = ts.findAncestor(node.parent, ts.isModuleDeclaration);
	if (scope === undefined) {
		return !ts.isExternalModule(node.getSourceFile());
	}
	return (scope.flags & ts.NodeFlags.GlobalAugmentation) !== 0 || (!ts.isStringLiteral(scope.name) && hostGlobal(scope));
}

function installedLibrary(file: ts.SourceFile, workspace: ReadonlySet<string>): boolean {
	const at = file.fileName.lastIndexOf(INSTALLED);
	const name = at < 0 ? undefined : nameAt(file.fileName.slice(at + INSTALLED.length));
	return name !== undefined && !(name === "effect" || name.startsWith("@effect/") || name.startsWith("@shivaedev/") || workspace.has(name));
}

// The syntax half already reports a Promise that is awaited, chained with then or bridged from an imported library, so those calls give no second finding.
export function promiseCall(program: ts.Program, workspace: ReadonlySet<string>) {
	const checker = program.getTypeChecker();
	const bridged = bridgedLibraryCall(checker, workspace);
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
		const signature = checker.getResolvedSignature(node);
		const declaration = signature?.declaration;
		const file = declaration?.getSourceFile();
		if (
			signature === undefined
			|| declaration === undefined
			|| file === undefined
			|| program.isSourceFileDefaultLibrary(file)
			|| hostGlobal(declaration)
			|| !installedLibrary(file, workspace)
		) {
			return undefined;
		}
		return promised(checker.getReturnTypeOfSignature(signature))
			? `${node.expression.getText()}(...), a library call that returns a Promise`
			: undefined;
	};
}
