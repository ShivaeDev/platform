import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { Cause, Effect, Exit } from "effect";
import { configureRegistered } from "#adapters/rule.ts";
import { type ImportGraph, importGraph } from "#imports/graph.ts";
import { workspacePackages } from "#imports/workspace.ts";
import type { Finding, Findings, RegisteredRule, Rule, RuleInputs } from "#rule.ts";
import { scanned } from "./imports.ts";
import type { SeedFile } from "./tree.ts";

export interface ImportEngine {
	findings: Findings | undefined;
	graph: ImportGraph | undefined;
	readonly root: string;
}

export function writeAll(root: string, files: readonly SeedFile[]): void {
	for (const file of files) {
		const path = join(root, file.path);
		mkdirSync(dirname(path), { recursive: true });
		writeFileSync(path, file.content);
	}
}

function present<TValue>(value: TValue | undefined, missing: string): TValue {
	if (value === undefined) {
		throw new Error(missing);
	}
	return value;
}

function only(inputs: RuleInputs, folder: string | undefined): RuleInputs {
	if (folder === undefined) {
		return inputs;
	}
	const sources = inputs.sources.filter((file) => file.path.startsWith(folder));
	return { ...inputs, files: sources.map((file) => file.path), sources };
}

const checked = Effect.fn("ImportStory.checked")(function* (engine: ImportEngine, rule: RegisteredRule, options: unknown, folder?: string) {
	const configured = yield* Effect.promise(() => configureRegistered(rule, options));
	if (configured._tag === "Invalid") {
		return yield* Effect.die(new Error(`${rule.id} refused its options: ${configured.issues.join("; ")}`));
	}
	const inputs = only(yield* Effect.promise(() => scanned(engine.root)), folder);
	engine.findings = yield* configured.check(inputs);
	return engine.findings;
});

function findings(engine: ImportEngine): Findings {
	return present(engine.findings, "Check a rule before reading its findings");
}

function described<TInput>(rule: Rule<string, TInput>, options: TInput | undefined): string {
	return options === undefined ? rule.id : `${rule.id} with ${JSON.stringify(options)}`;
}

export function importVerbs(engine: ImportEngine, tell: (line: string) => void) {
	function read(pick: (finding: Finding) => string) {
		return Effect.sync(() => findings(engine).map(pick));
	}
	return {
		check: <TInput>(rule: Rule<string, TInput>, options?: TInput) => {
			tell(`quality checks ${described(rule, options)}`);
			return checked(engine, rule, options);
		},
		checkOnly: <TInput>(rule: Rule<string, TInput>, folder: string) => {
			tell(`quality checks ${rule.id} over the sources under ${folder} only`);
			return checked(engine, rule, undefined, folder);
		},
		files: () => read((finding) => finding.file),
		findings: () => Effect.sync(() => findings(engine)),
		importsOf: (file: string) =>
			Effect.sync(() =>
				present(engine.graph, "Map the imports before reading them")
					.edges.filter((edge) => edge.from === file)
					.map((edge) => (edge.to.kind === "file" ? edge.to.path : edge.to.specifier)),
			),
		locations: () => read((finding) => (finding.line === undefined ? finding.file : `${finding.file}:${finding.line}`)),
		mapsImports: () =>
			Effect.promise(async () => {
				tell("quality maps the imports of the sources");
				engine.graph = await importGraph(await scanned(engine.root));
			}),
		messages: () => read((finding) => finding.message),
		refusal: <TInput>(rule: Rule<string, TInput>, options?: TInput) =>
			Effect.gen(function* () {
				tell(`quality checks ${described(rule, options)}`);
				const exit = yield* Effect.exit(checked(engine, rule, options));
				if (Exit.isSuccess(exit)) {
					return `no refusal: ${rule.id} reported ${exit.value.length} findings`;
				}
				const thrown = Cause.squash(exit.cause);
				return thrown instanceof Error ? thrown.message : String(thrown);
			}),
		removes: (path: string) =>
			Effect.sync(() => {
				tell(`the author removes ${path}`);
				rmSync(join(engine.root, path), { force: true, recursive: true });
			}),
		sites: () => read((finding) => `${finding.file}:${finding.line ?? ""} ${finding.subject ?? ""}`),
		subjects: () => read((finding) => finding.subject ?? ""),
		unresolvedImports: () =>
			Effect.sync(() => present(engine.graph, "Map the imports before reading them").unresolved.map((request) => request.specifier)),
		workspaceMembers: () =>
			Effect.promise(async () => {
				tell("quality reads the workspace members");
				return workspacePackages(await scanned(engine.root));
			}),
		writes: (...files: readonly SeedFile[]) =>
			Effect.sync(() => {
				tell(`the author writes ${files.map((file) => file.path).join(", ")}`);
				writeAll(engine.root, files);
			}),
	};
}
