import ts from "typescript";
import { effectCallee, unsafeOutsideEffect } from "#adapters/effectCalls.ts";
import { declaredModule } from "#imports/declaredModule.ts";

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

export function bridgeUse(program: ts.Program, source: ts.SourceFile, outside: (module: string) => boolean): boolean {
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
		const callee = effectCallee(checker, node);
		return callee !== undefined && RUNNERS.some(([module, member]) => module.test(callee.file) && member.test(callee.name));
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
			return promiseValue(checker.getTypeAtLocation(node)) || outsideCall(node) || runner(node) || unsafeOutsideEffect(checker, node);
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
