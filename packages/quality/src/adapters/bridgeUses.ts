import ts from "typescript";

// Host globals that reach the browser, the network, timers or randomness; pure data classes such as URL stay core code.
const HOST_GLOBALS = new Set([
	"addEventListener",
	"cancelAnimationFrame",
	"clearInterval",
	"clearTimeout",
	"crypto",
	"document",
	"EventSource",
	"fetch",
	"history",
	"indexedDB",
	"IntersectionObserver",
	"localStorage",
	"location",
	"MutationObserver",
	"navigator",
	"performance",
	"queueMicrotask",
	"removeEventListener",
	"requestAnimationFrame",
	"requestIdleCallback",
	"ResizeObserver",
	"sessionStorage",
	"setInterval",
	"setTimeout",
	"WebSocket",
	"window",
	"Worker",
]);

export function declaredModule(fileName: string): string | undefined {
	const path = fileName.replaceAll("\\", "/");
	const at = path.lastIndexOf("/node_modules/");
	if (at === -1) {
		return undefined;
	}
	const [scope = "", name = "", ...rest] = path.slice(at + "/node_modules/".length).split("/");
	const pkg = scope.startsWith("@") ? `${scope}/${name}` : scope;
	if (pkg === "@types/node") {
		const module = (scope.startsWith("@") ? rest : [name, ...rest]).join("/").replace(/\.d\.[cm]?ts$/u, "");
		return `node:${module.replace(/^node:/u, "")}`;
	}
	return pkg.startsWith("@types/") ? pkg.slice("@types/".length).replace(/^(?<scope>.+)__(?<name>.+)$/u, "@$<scope>/$<name>") : pkg;
}

function promise(type: ts.Type): boolean {
	return ["Promise", "PromiseLike"].includes(type.getSymbol()?.name ?? "");
}

function promiseValue(type: ts.Type): boolean {
	if (!type.isUnion()) {
		return promise(type);
	}
	const present = type.types.filter((part) => (part.flags & (ts.TypeFlags.Undefined | ts.TypeFlags.Null | ts.TypeFlags.Void)) === 0);
	return present.length > 0 && present.every(promise);
}

function unsafeClockRead(node: ts.Node): boolean {
	return ts.isPropertyAccessExpression(node) && node.name.text === "currentTimeMillisUnsafe";
}

export function adapterUse(program: ts.Program, source: ts.SourceFile, outside: (module: string) => boolean): boolean {
	const checker = program.getTypeChecker();
	function hostGlobal(node: ts.Node): boolean {
		return (
			ts.isIdentifier(node)
			&& (HOST_GLOBALS.has(node.text) || node.text === "Promise")
			&& (checker.getSymbolAtLocation(node)?.declarations ?? []).some((declaration) =>
				program.isSourceFileDefaultLibrary(declaration.getSourceFile()),
			)
		);
	}
	function outsideCall(node: ts.CallExpression | ts.NewExpression): boolean {
		const file = checker.getResolvedSignature(node)?.getDeclaration()?.getSourceFile();
		const module = file === undefined || program.isSourceFileDefaultLibrary(file) ? undefined : declaredModule(file.fileName);
		return module !== undefined && outside(module);
	}
	function promiseResult(node: ts.SignatureDeclaration): boolean {
		const signature = checker.getSignatureFromDeclaration(node);
		return signature !== undefined && promiseValue(checker.getReturnTypeOfSignature(signature));
	}
	function use(node: ts.Node): boolean {
		if (hostGlobal(node) || unsafeClockRead(node)) {
			return true;
		}
		if (ts.isCallExpression(node) || ts.isNewExpression(node)) {
			return promiseValue(checker.getTypeAtLocation(node)) || outsideCall(node);
		}
		return ts.isFunctionLike(node) && promiseResult(node);
	}
	function visit(node: ts.Node): boolean {
		if (ts.isTypeNode(node) || ts.isTypeAliasDeclaration(node) || ts.isInterfaceDeclaration(node)) {
			return false;
		}
		return use(node) || (ts.forEachChild(node, visit) ?? false);
	}
	return visit(source);
}
