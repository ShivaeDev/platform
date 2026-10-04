import { posix } from "node:path";
import ts from "typescript";
import { field, isRecord } from "./pattern.ts";

export type Emitted = (directory: string, file: string) => ReadonlySet<string>;

interface Build {
	readonly declarations: string | undefined;
	readonly files: ReadonlySet<string>;
	readonly jsx: boolean;
	readonly root: string;
	readonly scripts: string | undefined;
}

const MANIFEST = "package.json";

const CONFIGS = ["tsconfig.json", "tsconfig.build.json"];

const PROJECT_FLAG = /(?:^|\s)(?:--project|-p)(?:\s+|=)(?<path>[^\s&|;]+)/gu;

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

function scriptConfigs(directory: string): readonly string[] {
	const text = ts.sys.readFile(posix.join(directory, MANIFEST));
	let manifest: unknown;
	try {
		manifest = text === undefined ? undefined : JSON.parse(text);
	} catch {
		return [];
	}
	const scripts = field(manifest, "scripts");
	const commands = isRecord(scripts) ? Object.values(scripts).filter((command) => typeof command === "string") : [];
	return commands.flatMap((command) => [...command.matchAll(PROJECT_FLAG)].map((match) => posix.join(directory, match.groups?.path ?? "")));
}

function buildOf(path: string): Build | undefined {
	const parsed = ts.sys.fileExists(path) ? ts.getParsedCommandLineOfConfigFile(path, {}, quietHost) : undefined;
	const options = parsed?.options;
	if (parsed === undefined || options === undefined || options.noEmit === true || options.rootDir === undefined || options.outDir === undefined) {
		return undefined;
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

// A package's build turns a source file into its emitted script and declaration; they are the same module.
export function emittedModules(): Emitted {
	const builds = new Map<string, readonly Build[]>();
	function buildsIn(directory: string): readonly Build[] {
		const known =
			builds.get(directory)
			?? [...new Set([...CONFIGS.map((name) => posix.join(directory, name)), ...scriptConfigs(directory)])].flatMap((path) => buildOf(path) ?? []);
		builds.set(directory, known);
		return known;
	}
	return (directory, file) => new Set([file, ...buildsIn(directory).flatMap((build) => outputsOf(build, file))]);
}
