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

const DOM_LIBRARY = /(?:^|\/)lib\.(?:dom|webworker)[\w.]*\.d\.ts$/u;
const DOM_OWNERS =
	/^(?:Node|ParentNode|ChildNode|Element|HTML\w*|SVG\w*|Document\w*|ShadowRoot|Window\w*|EventTarget|Storage|History|Location|Navigator\w*|Selection|Range|CSSStyleDeclaration|DOMTokenList|\w+Observer)$/u;

function domMember(declaration: ts.Declaration): boolean {
	const owner = declaration.parent;
	return (
		DOM_LIBRARY.test(declaration.getSourceFile().fileName.replaceAll("\\", "/"))
		&& (ts.isInterfaceDeclaration(owner) || ts.isClassDeclaration(owner))
		&& DOM_OWNERS.test(owner.name?.text ?? "")
	);
}

// Each pair names an Effect module and the members that run an Effect from outside, or hand a runner to code that is not Effect.
const RUNNERS: readonly (readonly [RegExp, RegExp])[] = [
	[/\/Effect\.(?:d\.)?ts$/u, /^run[A-Z]/u],
	[/\/(?:Runtime|NodeRuntime|BunRuntime)\.(?:d\.)?ts$/u, /^(?:runMain|makeRunMain)$/u],
	[/\/(?:FiberSet|FiberMap|FiberHandle)\.(?:d\.)?ts$/u, /^makeRuntime/u],
	[/\/ManagedRuntime\.(?:d\.)?ts$/u, /^(?:make|run[A-Z])/u],
];

function unsafeClockRead(node: ts.Node): boolean {
	return ts.isPropertyAccessExpression(node) && /^currentTime\w*Unsafe$/u.test(node.name.text);
}

function calleeName(node: ts.CallExpression | ts.NewExpression): ts.Node {
	return ts.isPropertyAccessExpression(node.expression) ? node.expression.name : node.expression;
}

function effectModule(fileName: string): boolean {
	const module = declaredModule(fileName);
	return module === "effect" || module?.startsWith("@effect/") === true;
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
		const declaration = checker.getResolvedSignature(node)?.getDeclaration();
		const file = declaration?.getSourceFile();
		if (declaration !== undefined && file !== undefined && program.isSourceFileDefaultLibrary(file)) {
			return domMember(declaration);
		}
		const module = file === undefined ? undefined : declaredModule(file.fileName);
		return module !== undefined && outside(module);
	}
	function runner(node: ts.CallExpression | ts.NewExpression): boolean {
		const symbol = checker.getSymbolAtLocation(calleeName(node));
		const target = symbol !== undefined && symbol.flags & ts.SymbolFlags.Alias ? checker.getAliasedSymbol(symbol) : symbol;
		const file = target?.declarations?.[0]?.getSourceFile().fileName.replaceAll("\\", "/");
		return (
			target !== undefined
			&& file !== undefined
			&& effectModule(file)
			&& RUNNERS.some(([module, member]) => module.test(file) && member.test(target.name))
		);
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
			return promiseValue(checker.getTypeAtLocation(node)) || outsideCall(node) || runner(node);
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
