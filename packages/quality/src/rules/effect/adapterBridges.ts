import { join, posix } from "node:path";
import { Effect } from "effect";
import { bridgeUse } from "#adapters/bridgeUse.ts";
import { capturedContexts } from "#adapters/contextCaptureFindings.ts";
import { exportsOutsideType } from "#adapters/exportsOutsideType.ts";
import { packageOf, workspacePackages } from "#imports/workspace.ts";
import { inAdapters } from "#naming/inAdapters.ts";
import { isTestCode } from "#naming/testName.ts";
import { acceptedInCore, outsideImports } from "#outsideImportFindings.ts";
import { defineRule, type RuleInputs, type SourceFile } from "#rule.ts";
import { boundaryFindings } from "#rules/effect/boundary.ts";
import { entryModules } from "#rules/effect/boundaryReference.ts";
import { effectProgram } from "#rules/effect/program.ts";

const MESSAGE =
	"Uses nothing only an adapter may use: no outside library or Node builtin value, host global, DOM call, unsafe clock read, async, throw or Promise, Effect runner, Unsafe Effect call outside an Effect, captured context or export that mentions an outside library's type. This is core code under the Effect rules; move it out of adapters/.";

function vendor(module: string): boolean {
	return !(module.startsWith("node:") || module === "effect" || module.startsWith("@effect/") || module.startsWith("@shivaedev/"));
}

function serviceFolders(files: readonly SourceFile[], bridges: ReadonlySet<string>): ReadonlySet<string> {
	const folders = new Set(files.filter((file) => posix.basename(file.path) === "service.ts").map((file) => posix.dirname(file.path)));
	return new Set([...folders].filter((folder) => files.some((file) => posix.dirname(file.path) === folder && bridges.has(file.path))));
}

const adapterBridgeFindings = Effect.fn("Adapters.adapterBridgeFindings")(function* (inputs: RuleInputs) {
	const candidates = inputs.sources.filter(
		(file) => inAdapters(file.path) && !isTestCode(file.path) && /\.[cm]?[jt]sx?$/u.test(file.path) && !/\.d\.[cm]?ts$/u.test(file.path),
	);
	if (candidates.length === 0) {
		return [];
	}
	const bridges = new Set((yield* outsideImports(inputs)).map((site) => site.from));
	function remaining(): readonly SourceFile[] {
		return candidates.filter((file) => !bridges.has(file.path));
	}
	for (const finding of yield* boundaryFindings({ ...inputs, sources: remaining() })) {
		bridges.add(finding.file);
	}
	for (const finding of yield* capturedContexts({ ...inputs, sources: remaining() })) {
		bridges.add(finding.file);
	}
	const packages = yield* workspacePackages(inputs);
	const entries = entryModules(remaining());
	const program = yield* effectProgram({ ...inputs, sources: remaining() });
	for (const file of remaining()) {
		const source = program.getSourceFile(join(inputs.root, file.path));
		const directory = packageOf(packages, file.path)?.directory ?? ".";
		function outside(module: string): boolean {
			return !(acceptedInCore(directory, file.path, module) || (module === "node:process" && entries.has(file.path)));
		}
		if (source !== undefined && (bridgeUse(program, source, outside) || exportsOutsideType(program, source, vendor))) {
			bridges.add(file.path);
		}
	}
	// effect/service-model keeps a service's operations beside its service.ts, so one bridging operation keeps the folder whole.
	const services = serviceFolders(candidates, bridges);
	return remaining()
		.filter((file) => !services.has(posix.dirname(file.path)))
		.map((file) => ({ file: file.path, message: MESSAGE }));
});

export const adapterBridges = defineRule({
	check: adapterBridgeFindings,
	description:
		"A production file in a folder named adapters/ uses something only an adapter may use: a value of an outside library, peer, optional dependency or node:* builtin (imported, called or constructed), a host global such as window, fetch, timers or crypto, a call on a DOM node, document, window or observer, a synchronous currentTime*Unsafe clock read, async, await, try, throw, a Promise value or Promise-typed parameter, an Effect runner (Effect.run*, runMain, ManagedRuntime, FiberSet, FiberMap or FiberHandle makeRuntime), an Effect *Unsafe function called from a plain function or callback rather than from inside an Effect, a captured context (Effect.provideContext, runPromiseWith, runForkWith, Effect.provide with a Context), or an exported declaration whose declared or inferred type mentions a type an outside library declares, even through a type-only import. What core code may import and a type-only import that never reaches an export do not count. A service folder with one such file stays whole, since its operations sit beside service.ts. Move a file that bridges nothing out of adapters/ into core, where the Effect rules apply.",
	id: "effect/adapter-bridges",
	registrable: false,
});
