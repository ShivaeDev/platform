import { posix } from "node:path";
import ts from "typescript";
import { buildConfigs, UNKNOWN_BUILD } from "./build-configs.ts";

export type Emitted = (directory: string, file: string) => ReadonlySet<string>;

interface Build {
	readonly declarations: string | undefined;
	readonly files: ReadonlySet<string>;
	readonly jsx: boolean;
	readonly root: string;
	readonly scripts: string | undefined;
}

const UNKNOWN = "unknown";

const SILENT = "silent";

type Plan = Build | typeof SILENT | typeof UNKNOWN;

const OUTPUTS: Readonly<Record<string, readonly [string, string]>> = {
	".cjs": [".cjs", ".d.cts"],
	".cts": [".cjs", ".d.cts"],
	".js": [".js", ".d.ts"],
	".jsx": [".js", ".d.ts"],
	".mjs": [".mjs", ".d.mts"],
	".mts": [".mjs", ".d.mts"],
	".ts": [".js", ".d.ts"],
	".tsx": [".js", ".d.ts"],
};

const quietHost: ts.ParseConfigFileHost = { ...ts.sys, onUnRecoverableConfigFileDiagnostic: () => undefined };

function planOf(path: string): Plan {
	const parsed = ts.sys.fileExists(path) ? ts.getParsedCommandLineOfConfigFile(path, {}, quietHost) : undefined;
	const options = parsed?.options;
	if (parsed === undefined || options === undefined || parsed.errors.length > 0) {
		return UNKNOWN;
	}
	if (options.noEmit === true) {
		return SILENT;
	}
	if (options.rootDir === undefined || options.outDir === undefined) {
		return UNKNOWN;
	}
	const declares = options.declaration === true || options.composite === true;
	return {
		declarations: declares ? (options.declarationDir ?? options.outDir) : undefined,
		files: new Set(parsed.fileNames),
		jsx: options.jsx === ts.JsxEmit.Preserve,
		root: options.rootDir,
		scripts: options.emitDeclarationOnly === true ? undefined : options.outDir,
	};
}

function buildsIn(directory: string): readonly Build[] | undefined {
	const configs = buildConfigs(directory);
	const plans: readonly Plan[] = configs.includes(UNKNOWN_BUILD) ? [UNKNOWN] : configs.map(planOf);
	return plans.includes(UNKNOWN) ? undefined : plans.filter((plan) => typeof plan !== "string");
}

function outputsOf(build: Build, file: string): readonly string[] {
	const extension = posix.extname(file);
	const outputs = OUTPUTS[extension];
	const relative = posix.relative(build.root, file);
	if (outputs === undefined || !build.files.has(file) || relative.startsWith("..") || file.endsWith(`.d${extension}`)) {
		return [];
	}
	const stem = relative.slice(0, -extension.length);
	const [script, declaration] = outputs;
	const scriptExtension = build.jsx && (extension === ".tsx" || extension === ".jsx") ? ".jsx" : script;
	return [
		...(build.scripts === undefined ? [] : [posix.join(build.scripts, `${stem}${scriptExtension}`)]),
		...(build.declarations === undefined ? [] : [posix.join(build.declarations, `${stem}${declaration}`)]),
	];
}

function agreedOutputs(builds: readonly Build[], file: string): readonly string[] {
	const placements = builds.map((build) => outputsOf(build, file)).filter((outputs) => outputs.length > 0);
	const distinct = new Set(placements.map((outputs) => outputs.join("\n")));
	return distinct.size === 1 ? (placements[0] ?? []) : [];
}

// A package's build turns a source file into its emitted script and declaration; they are the same module.
export function emittedModules(): Emitted {
	const builds = new Map<string, readonly Build[] | undefined>();
	return (directory, file) => {
		const known = builds.has(directory) ? builds.get(directory) : buildsIn(directory);
		builds.set(directory, known);
		return new Set([file, ...agreedOutputs(known ?? [], file)]);
	};
}
